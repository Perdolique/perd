import type { BrowserContext, Page, Route } from '@playwright/test'
import * as v from 'valibot'
import type { PackingListDetail, PackingListEntry, PackingListSummary } from '../../../app/types/packing'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { createDeferred, mockGuestLogin } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'

interface CopyReply {
  status?: number;
  gate?: Promise<void>;
  abort?: boolean;
  commitBeforeReply?: boolean;
}

interface CopyState {
  lists: Map<string, PackingListDetail>;
  copyBodies: unknown[];
  copyReplies: CopyReply[];
  overviewGates: Promise<void>[];
  overviewStatus: number;
  overviewRequests: number;
  packGate: Promise<void> | null;
  packRequests: number;
}

const originalId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const copyId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const date = '2026-10-06T08:00:00.000Z'

function createEntries(): PackingListEntry[] {
  return [{
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
    customName: 'Rain jacket',
    source: 'custom',
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }, {
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
    customName: null,
    source: 'inventory',
    isPacked: true,
    createdAt: date,
    updatedAt: date,

    inventory: {
      source: 'custom',
      inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477a1',
      itemName: 'Private stove'
    }
  }]
}

function createState(name = 'Alpine weekend', entries = createEntries()): CopyState {
  const original: PackingListDetail = {
    id: originalId,
    name,
    entries,
    createdAt: date,
    updatedAt: date
  }

  return {
    lists: new Map([[originalId, original]]),
    copyBodies: [],
    copyReplies: [],
    overviewGates: [],
    overviewStatus: 200,
    overviewRequests: 0,
    packGate: null,
    packRequests: 0
  }
}

function summary(list: PackingListDetail): PackingListSummary {
  const packed = list.entries.filter(entry => entry.isPacked)

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    entryCount: list.entries.length,
    packedCount: packed.length
  }
}

function requiredList(state: CopyState, id: string) {
  const list = state.lists.get(id)

  if (list === undefined) {
    throw new Error('Missing packing list fixture')
  }

  return list
}

function commitCopy(state: CopyState, original: PackingListDetail, name: string) {
  const copiedEntries = original.entries.map((entry, index) => {
    const suffix = String(index).padStart(3, '0')
    const id = `0195f6e8-8f44-74f6-bc9a-5c8f7df48${suffix}`

    return {
      ...entry,
      id,
      isPacked: false
    }
  })

  const copy: PackingListDetail = {
    id: copyId,
    name,
    entries: copiedEntries,
    createdAt: date,
    updatedAt: date
  }

  state.lists.set(copyId, copy)

  return summary(copy)
}

async function respondCopy(route: Route, state: CopyState, original: PackingListDetail) {
  const raw: unknown = route.request().postDataJSON()
  const body = v.parse(v.object({ name: v.string() }), raw)
  const reply = state.copyReplies.shift()

  state.copyBodies.push(body)

  const committed = reply?.commitBeforeReply === true ? commitCopy(state, original, body.name) : null

  await reply?.gate

  if (reply?.abort === true) {
    await route.abort('failed')

    return
  }

  if (reply?.status !== undefined) {
    await route.fulfill({
      status: reply.status,
      json: { message: 'Private database details' }
    })

    return
  }

  const response = committed ?? commitCopy(state, original, body.name)

  await route.fulfill({
    status: 201,
    json: response
  })
}

async function respondOriginalRefresh(route: Route, state: CopyState, gate: Promise<void> | undefined) {
  const request = route.request()
  const original = requiredList(state, originalId)
  const snapshot = globalThis.structuredClone(original)

  await gate

  if (request.failure() === null) {
    await route.fulfill({ json: snapshot })
  }
}

async function respondList(route: Route, state: CopyState) {
  const request = route.request()
  const url = new globalThis.URL(request.url())
  const parts = url.pathname.split('/')
  const [id = '', action] = parts.slice(4)

  if (id === '') {
    const gate = state.overviewGates.shift()

    state.overviewRequests += 1
    await gate

    if (request.failure() === null) {
      const lists = [...state.lists.values()]
      const rows = lists.map(list => summary(list))

      await route.fulfill({
        status: state.overviewStatus,
        json: rows
      })
    }

    return
  }

  const list = requiredList(state, id)

  if (action === 'copy') {
    await respondCopy(route, state, list)

    return
  }

  if (action === 'available-gear') {
    await route.fulfill({ json: {
      items: [],
      nextPage: null
    } })

    return
  }

  if (action === 'entries') {
    const entryId = parts.at(6)
    const raw: unknown = request.postDataJSON()
    const body = v.parse(v.object({ isPacked: v.boolean() }), raw)
    const entry = list.entries.find(row => row.id === entryId)

    if (entry === undefined) {
      throw new Error('Missing packing entry fixture')
    }

    state.packRequests += 1
    await state.packGate

    const updated = {
      ...entry,
      isPacked: body.isPacked
    }

    list.entries = list.entries.map(row => row.id === entryId ? updated : row)

    await route.fulfill({ json: {
      entry: updated,
      packingListUpdatedAt: date
    } })

    return
  }

  if (request.method() === 'PATCH') {
    const raw: unknown = request.postDataJSON()
    const body = v.parse(v.object({ name: v.string() }), raw)

    list.name = body.name
  }

  await route.fulfill({ json: list })
}

async function setup(context: BrowserContext, state: CopyState) {
  await mockGuestLogin(context)

  await context.route('**/api/user/packing-lists**', async route => {
    await respondList(route, state)
  })
}

async function openOriginal(page: Page) {
  await page.goto('/login?redirectTo=/packing-lists')
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: /Continue as guest/iu }).click()
  await page.getByRole('link', { name: /Alpine weekend|Empty trip|🎒/u }).click()
  await expect(page.getByRole('button', { name: /^Actions for /u })).toBeVisible()
}

async function openCopy(page: Page) {
  await page.getByRole('button', { name: /^Actions for /u }).click()

  await page.getByRole('menuitem', {
    name: 'Copy list',
    exact: true
  }).click()

  return page.getByRole('dialog', { name: 'Copy packing list' })
}

function requiredBox(box: Awaited<ReturnType<ReturnType<Page['getByRole']>['boundingBox']>>) {
  if (box === null) {
    throw new Error('Expected visible menu bounds')
  }

  return box
}

async function dismissCopy(page: Page, dismissal: string) {
  const control = page.getByRole('dialog', { name: 'Copy packing list' }).getByRole('button', { name: 'Cancel' })
  const dismiss = dismissal === 'Cancel' ? control.click() : page.keyboard.press('Escape')

  await dismiss
}

async function validateCopyNames(dialog: ReturnType<Page['getByRole']>) {
  const input = dialog.getByLabel('List name')
  const confirm = dialog.getByRole('button', { name: 'Create copy' })
  const excessiveName = 'A'.repeat(129)
  const invalidNames = ['', '   ', excessiveName]

  for (const name of invalidNames) {
    // oxlint-disable-next-line no-await-in-loop -- Each invalid submit must complete before the next draft.
    await input.fill(name)

    // oxlint-disable-next-line no-await-in-loop -- Submit the current draft.
    await confirm.click()

    // oxlint-disable-next-line no-await-in-loop -- Assert the retained draft before replacing it.
    await expect(input).toHaveValue(name)

    // oxlint-disable-next-line no-await-in-loop -- Each invalid draft owns its accessible error state.
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    // oxlint-disable-next-line no-await-in-loop -- Each rejection must return focus to the name field.
    await expect(input).toBeFocused()
  }
}

function recordIncompleteCopyDialog(element: Element) {
  const observer = new globalThis.MutationObserver(() => {
    const input = element.querySelector('input[name="packing-list-copy-name"]')
    const explanation = element.querySelector('p')

    const isExplanationVisible = explanation?.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true
    }) === true

    if (element.isConnected && input === null && isExplanationVisible) {
      globalThis.document.documentElement.dataset.incompleteCopyDialog = 'true'
    }
  })

  observer.observe(element, {
    attributes: true,
    childList: true,
    subtree: true
  })
}

test.describe('Copy packing list', () => {
  for (const width of [390, 1280]) {
    test(`keeps copy open after repeated menu clicks at ${width}px until explicit confirmation`, async ({ context, page }) => {
      const state = createState()

      await page.setViewportSize({
        width,
        height: 900
      })

      await setup(context, state)
      await openOriginal(page)
      await page.getByRole('button', { name: 'Actions for Alpine weekend' }).click()

      await page.getByRole('menuitem', {
        name: 'Copy list',
        exact: true
      }).dblclick()

      const dialog = page.getByRole('dialog', { name: 'Copy packing list' })
      const input = dialog.getByLabel('List name')

      await expect(input).toHaveValue('Alpine weekend — copy')

      await dialog.evaluate(async element => {
        const animations = element.getAnimations()

        const animationPromises = animations.map(async animation => {
          await animation.finished
        })

        await Promise.all(animationPromises)
      })

      await page.mouse.click(1, 1)
      await expect(dialog).toBeVisible()
      await expect(page).toHaveURL(`/packing-lists/${originalId}`)
      expect(state.copyBodies).toStrictEqual([])
      await input.fill('Deliberate copy')
      await dialog.getByRole('button', { name: 'Create copy' }).click()

      await expect(page.getByRole('heading', {
        level: 1,
        name: 'Deliberate copy'
      })).toBeFocused()

      await expect(page).toHaveURL(`/packing-lists/${copyId}`)
      expect(state.copyBodies).toStrictEqual([{ name: 'Deliberate copy' }])
    })
  }

  test('does not flash a half-empty copy dialog while the copied page loads', async ({ context, page }) => {
    const state = createState()
    const detailRequested = createDeferred()
    const detailGate = createDeferred()

    await setup(context, state)

    await page.route(`**/api/user/packing-lists/${copyId}`, async route => {
      detailRequested.resolve()

      await detailGate.promise

      const copy = requiredList(state, copyId)

      await route.fulfill({ json: copy })
    })

    await openOriginal(page)

    const dialog = await openCopy(page)

    await dialog.evaluate(async element => {
      const animations = element.getAnimations()

      const animationPromises = animations.map(async animation => {
          await animation.finished
        })

      await Promise.all(animationPromises)
    })

    await dialog.evaluate(recordIncompleteCopyDialog)
    await dialog.getByRole('button', { name: 'Create copy' }).click()

    try {
      await detailRequested.promise

      const incompleteDialog = await page.locator('html').getAttribute('data-incomplete-copy-dialog')

      expect(incompleteDialog).not.toBe('true')
      await expect(dialog).toBeHidden()
    } finally {
      detailGate.resolve()
    }

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Alpine weekend — copy'
    })).toBeFocused()

    await expect(page).toHaveURL(`/packing-lists/${copyId}`)
    expect(state.copyBodies).toStrictEqual([{ name: 'Alpine weekend — copy' }])
  })

  test('opens an independent unpacked copy, preserves edits after reload, and shows both lists in the overview', async ({ context, page }) => {
    const state = createState()

    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)

    await expect(dialog.getByLabel('List name')).toHaveValue('Alpine weekend — copy')
    await expect(page.getByRole('menu', { name: 'Packing list actions' })).toBeHidden()
    await dialog.getByLabel('List name').fill('  Winter kit  ')
    await dialog.getByRole('button', { name: 'Create copy' }).click()
    await expect(page).toHaveURL(`/packing-lists/${copyId}`)

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Winter kit'
    })).toBeFocused()

    await expect(page.getByRole('checkbox', { name: 'Rain jacket' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Private stove' })).not.toBeChecked()
    await page.getByRole('checkbox', { name: 'Rain jacket' }).check()
    await expect.poll(() => state.packRequests).toBe(1)
    await page.getByRole('button', { name: 'Actions for Winter kit' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByLabel('List name').fill('Winter kit revised')
    await page.getByRole('button', { name: 'Save name' }).click()
    await page.reload()
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: /Continue as guest/iu }).click()

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Winter kit revised'
    })).toBeVisible()

    await expect(page.getByRole('checkbox', { name: 'Rain jacket' })).toBeChecked()
    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
    await expect(page.getByRole('link', { name: /Winter kit revised/iu })).toContainText('1 of 2 packed')
    await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toContainText('2 of 2 packed')
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await expect(page.getByRole('checkbox', { name: 'Rain jacket' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Private stove' })).toBeChecked()
    expect(state.copyBodies).toStrictEqual([{ name: 'Winter kit' }])
  })

  test('copies an empty list with the same name', async ({ context, page }) => {
    const state = createState('Empty trip', [])

    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)

    await dialog.getByLabel('List name').fill('Empty trip')
    await dialog.getByRole('button', { name: 'Create copy' }).click()
    await expect(page).toHaveURL(`/packing-lists/${copyId}`)

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Empty trip'
    })).toBeFocused()

    expect(requiredList(state, copyId).entries).toStrictEqual([])
  })

  test('keeps one header button, ordered menu items, keyboard navigation, focus return, and Unicode names usable on mobile', async ({ context, page }) => {
    const longName = '🎒'.repeat(64)
    const state = createState(longName)

    await page.setViewportSize({
      width: 320,
      height: 740
    })

    await setup(context, state)
    await openOriginal(page)

    const trigger = page.getByRole('button', { name: `Actions for ${longName}` })
    const menu = page.getByRole('menu', { name: 'Packing list actions' })

    await expect(page.getByRole('button', { name: /^(?:Copy list|Rename|Delete)$/u })).toHaveCount(0)
    await expect(trigger).toHaveText('Actions')
    await trigger.focus()
    await trigger.press('ArrowDown')
    await expect(menu.getByRole('menuitem')).toHaveText(['Copy list', 'Rename', 'Delete'])
    await expect(menu.getByRole('separator')).toHaveCount(1)
    await expect(menu.getByRole('menuitem', { name: 'Copy list' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.press('ArrowUp')
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Copy packing list' })
    const input = dialog.getByLabel('List name')

    await expect(input).toBeFocused()

    const truncatedName = '🎒'.repeat(60)
    const defaultCopyName = `${truncatedName} — copy`

    await expect(input).toHaveValue(defaultCopyName)
    await expect(menu).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.click()

    const box = await menu.boundingBox()
    const bounds = requiredBox(box)

    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
    await page.keyboard.press('Escape')
    await expect.poll( async () => page.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    expect(state.copyBodies).toStrictEqual([])
  })

  for (const dismissal of ['Cancel', 'Escape']) {
    test(`creates nothing on ${dismissal} and restores focus`, async ({ context, page }) => {
      const state = createState()

      await setup(context, state)
      await openOriginal(page)

      const dialog = await openCopy(page)

      await dialog.getByLabel('List name').fill('Discarded draft')
      await dismissCopy(page, dismissal)
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeFocused()
      expect(state.copyBodies).toStrictEqual([])
    })
  }

  test('validates names, blocks duplicate submission and dismissal, retains failures, and retries after refreshing a conflict', async ({ context, page, expectConsoleError }) => {
    const state = createState()
    const gate = createDeferred()

    state.copyReplies.push({
      gate: gate.promise,
      status: 409
    }, { status: 400 })

    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)
    const input = dialog.getByLabel('List name')
    const confirm = dialog.getByRole('button', { name: 'Create copy' })

    await validateCopyNames(dialog)
    expect(state.copyBodies).toStrictEqual([])
    await input.fill('Retry trip')

    const conflictLog = expectConsoleError(/Failed to copy packing list:/u)

    try {
      await confirm.dblclick()
      await expect.poll(() => state.copyBodies.length).toBe(1)
      await expect(input).toBeDisabled()
      await expect(confirm).toBeDisabled()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await page.mouse.click(5, 5)
      await expect(dialog).toBeVisible()
      gate.resolve()

      await conflictLog

      await expect(dialog.getByRole('alert')).toContainText('Refresh the original list')
      await expect(input).toHaveValue('Retry trip')
      await expect(input).toBeFocused()

      const refreshedOriginal = page.waitForResponse(response => response.url().endsWith(`/packing-lists/${originalId}`))

      requiredList(state, originalId).name = 'Updated original'

      await dialog.getByRole('button', { name: 'Refresh original list' }).click()

      await refreshedOriginal

      await expect(page.getByRole('heading', {
        name: 'Updated original',
        exact: true
      })).toBeVisible()

      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await expect(dialog.getByRole('button', { name: 'Refresh original list' })).toHaveCount(0)
      await expect(input).toHaveValue('Retry trip')
      await expect(input).toBeFocused()
      await expect(confirm).toBeEnabled()

      const refusalLog = expectConsoleError(/Failed to copy packing list:/u)

      await confirm.click()

      await refusalLog

      await expect(dialog.getByRole('alert')).toHaveText('Could not copy the list. Try again.')
      await expect(input).toHaveValue('Retry trip')

      const maximumName = 'A'.repeat(128)

      await input.fill(maximumName)
      await input.press('Enter')
      await expect(page).toHaveURL(`/packing-lists/${copyId}`)
      expect(state.copyBodies).toHaveLength(3)
    } finally {
      gate.resolve()
    }
  })

  test('preserves the copy draft after a failed original refresh and clears the conflict after a successful retry', async ({ context, page, expectConsoleError }) => {
    const state = createState()
    const gate = createDeferred()

    state.copyReplies.push({ status: 409 })
    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)
    const input = dialog.getByLabel('List name')
    const confirm = dialog.getByRole('button', { name: 'Create copy' })
    const conflictLog = expectConsoleError(/Failed to copy packing list:/u)

    await input.fill('Kept draft')
    await confirm.click()

    await conflictLog

    let refreshStatus = 500
    let refreshRequests = 0

    await page.route(`**/api/user/packing-lists/${originalId}`, async route => {
      refreshRequests += 1
      await gate.promise

      const original = requiredList(state, originalId)

      await route.fulfill({
        status: refreshStatus,
        json: original
      })
    })

    const refresh = dialog.getByRole('button', { name: 'Refresh original list' })
    const refreshFailure = expectConsoleError(/Failed to refresh the original packing list:/u)

    try {
      await refresh.click()
      await expect.poll(() => refreshRequests).toBe(1)
      await expect(refresh).toHaveAttribute('aria-busy', 'true')
      await expect(confirm).toBeDisabled()
      await expect(input).toHaveValue('Kept draft')
      gate.resolve()

      await refreshFailure

      await expect(dialog.getByRole('alert')).toHaveText('Could not refresh the original list. Try refreshing again.')
      await expect(input).toHaveValue('Kept draft')
      await expect(refresh).toBeEnabled()

      refreshStatus = 200
      requiredList(state, originalId).name = 'Refreshed original'

      await refresh.click()
      await expect.poll(() => refreshRequests).toBe(2)

      await expect(page.getByRole('heading', {
        name: 'Refreshed original',
        exact: true
      })).toBeVisible()

      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await expect(refresh).toHaveCount(0)
      await expect(input).toHaveValue('Kept draft')
      await expect(input).toBeFocused()
      await expect(confirm).toBeEnabled()
      await confirm.click()
      await expect(page).toHaveURL(`/packing-lists/${copyId}`)
      expect(state.copyBodies).toStrictEqual([{ name: 'Kept draft' }, { name: 'Kept draft' }])
    } finally {
      gate.resolve()
    }
  })

  test('cancels a dismissed original refresh before a reopened dialog refreshes newer entries', async ({ context, page, expectConsoleError }) => {
    const state = createState()
    const gate = createDeferred()
    const originalPath = `/api/user/packing-lists/${originalId}`
    const originalRoute = `**${originalPath}`

    state.copyReplies.push({ status: 409 }, { status: 409 })
    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)
    const conflictLog = expectConsoleError(/Failed to copy packing list:/u)

    await dialog.getByRole('button', { name: 'Create copy' }).click()

    await conflictLog

    let refreshRequests = 0
    const refreshGates = [gate.promise]

    await page.route(originalRoute, async route => {
      const refreshGate = refreshGates.shift()

      refreshRequests += 1

      await respondOriginalRefresh(route, state, refreshGate)
    })

    try {
      await dialog.getByRole('button', { name: 'Refresh original list' }).click()
      await expect.poll(() => refreshRequests).toBe(1)

      const abortedRefresh = page.waitForEvent('requestfailed', {
        predicate: request => request.url().endsWith(originalPath),
        timeout: 5000
      })

      await dialog.getByRole('button', { name: 'Cancel' }).click()

      const request = await abortedRefresh

      expect(request.failure()?.errorText).toContain('ERR_ABORTED')
      await expect(dialog).toHaveCount(0)

      const original = requiredList(state, originalId)

      const addedEntry: PackingListEntry = {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3',
        customName: 'Fresh sleeping bag',
        source: 'custom',
        isPacked: false,
        createdAt: date,
        updatedAt: date
      }

      original.entries.push(addedEntry)

      const reopened = await openCopy(page)
      const secondConflictLog = expectConsoleError(/Failed to copy packing list:/u)

      await reopened.getByRole('button', { name: 'Create copy' }).click()

      await secondConflictLog

      await reopened.getByRole('button', { name: 'Refresh original list' }).click()
      await expect(page.getByText('Fresh sleeping bag', { exact: true })).toBeVisible()
      await expect(reopened.getByLabel('List name')).toBeFocused()
      gate.resolve()
      await reopened.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Fresh sleeping bag', { exact: true })).toBeVisible()
      expect(refreshRequests).toBe(2)
    } finally {
      gate.resolve()
    }
  })

  for (const status of [500, 502, 504]) {
    test(`checks a fresh overview after an uncertain ${status} response without creating another copy`, async ({ context, page, expectConsoleError }) => {
      const state = createState()
      const gate = createDeferred()

      state.copyReplies.push({
        status,
        commitBeforeReply: true
      })

      await setup(context, state)
      await openOriginal(page)

      const dialog = await openCopy(page)
      const copyFailure = expectConsoleError(/Failed to copy packing list:/u)

      await dialog.getByRole('button', { name: 'Create copy' }).click()

      await copyFailure

      await expect(dialog.getByRole('alert')).toHaveText('Could not confirm the copy. Check Packing lists before trying again.')
      await expect(dialog.getByRole('button', { name: 'Create copy' })).toBeDisabled()
      await expect(dialog.getByLabel('List name')).toHaveValue('Alpine weekend — copy')
      state.overviewGates.push(gate.promise)

      state.overviewStatus = 500

      const refreshFailure = expectConsoleError(/Failed to load packing lists:/u)

      try {
        await dialog.getByRole('link', { name: 'Packing lists' }).click()
        await expect(page.getByText('Refreshing packing lists…', { exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: /Alpine weekend — copy/iu })).toHaveCount(0)
        gate.resolve()

        await refreshFailure

        await expect(page.getByRole('alert')).toHaveText('Could not refresh packing lists. The lists below may be out of date.')
        await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()

        state.overviewStatus = 200

        await page.getByRole('button', {
          name: 'Retry',
          exact: true
        }).click()

        await expect(page.getByRole('alert')).toHaveCount(0)
        await expect(page.getByRole('link', { name: /Alpine weekend — copy/iu })).toHaveCount(1)
        expect(state.copyBodies).toStrictEqual([{ name: 'Alpine weekend — copy' }])
      } finally {
        gate.resolve()
      }
    })
  }

  for (const refusal of [{
    status: 401,
    message: 'Your session expired. Sign in before copying this list.',
    link: 'Sign in',
    path: '/login'
  }, {
    status: 404,
    message: 'The original list is no longer available. Check Packing lists.',
    link: 'Packing lists',
    path: '/packing-lists'
  }]) {
    test(`offers recovery instead of another POST after ${refusal.status}`, async ({ context, page, expectConsoleError }) => {
      const state = createState()

      state.copyReplies.push({ status: refusal.status })
      await setup(context, state)
      await openOriginal(page)

      const dialog = await openCopy(page)
      const failure = expectConsoleError(/Failed to copy packing list:/u)

      await dialog.getByLabel('List name').fill('Retained name')
      await dialog.getByRole('button', { name: 'Create copy' }).click()

      await failure

      await expect(dialog.getByRole('alert')).toHaveText(refusal.message)
      await expect(dialog.getByLabel('List name')).toHaveValue('Retained name')
      await expect(dialog.getByRole('button', { name: 'Create copy' })).toBeDisabled()
      await expect(dialog.getByRole('link', { name: refusal.link })).toHaveAttribute('href', refusal.path)
      expect(state.copyBodies).toStrictEqual([{ name: 'Retained name' }])
    })
  }

  test('shows one copy when the overview sees its commit before the POST response', async ({ context, page, expectConsoleError }) => {
    const state = createState()
    const gate = createDeferred()

    state.copyReplies.push({
      gate: gate.promise,
      commitBeforeReply: true
    })

    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)
    const copiedCard = page.getByRole('link', { name: /Alpine weekend — copy/iu })

    try {
      await dialog.getByRole('button', { name: 'Create copy' }).click()
      await expect.poll(() => state.copyBodies.length).toBe(1)
      await page.goBack()
      await expect(copiedCard).toHaveCount(1)

      state.overviewStatus = 500

      const refreshFailure = expectConsoleError(/Failed to load packing lists:/u)

      gate.resolve()

      await refreshFailure

      await expect(page.getByRole('alert')).toContainText('may be out of date')
      await expect(copiedCard).toHaveCount(1)
      await expect(page).toHaveURL('/packing-lists')
      expect(state.copyBodies).toHaveLength(1)
    } finally {
      gate.resolve()
    }
  })

  test('keeps copy and deletion disabled while the original has a pending packed change', async ({ context, page }) => {
    const state = createState()
    const gate = createDeferred()

    state.packGate = gate.promise

    await setup(context, state)
    await openOriginal(page)

    try {
      await page.getByRole('checkbox', { name: 'Rain jacket' }).uncheck()
      await expect.poll(() => state.packRequests).toBe(1)
      await page.getByRole('button', { name: /^Actions for /u }).click()
      await expect(page.getByRole('menuitem', { name: 'Copy list' })).toHaveAttribute('aria-disabled', 'true')
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true')
      await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute('aria-disabled', 'false')
      await page.getByRole('menuitem', { name: 'Copy list' }).press('Enter')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(state.copyBodies).toStrictEqual([])
      gate.resolve()
      await expect(page.getByRole('menuitem', { name: 'Copy list' })).toHaveAttribute('aria-disabled', 'false')
    } finally {
      gate.resolve()
    }
  })

  test('does not retry a lost POST response and points to the overview before another attempt', async ({ context, page, expectConsoleError }) => {
    const state = createState()

    state.copyReplies.push({ abort: true })
    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)
    const log = expectConsoleError(/Failed to copy packing list:/u)

    await dialog.getByRole('button', { name: 'Create copy' }).click()

    await log

    await expect(dialog.getByRole('alert')).toHaveText('Could not confirm the copy. Check Packing lists before trying again.')
    await expect(dialog.getByLabel('List name')).toHaveValue('Alpine weekend — copy')
    await expect(dialog.getByRole('button', { name: 'Create copy' })).toBeDisabled()
    await dialog.getByRole('link', { name: 'Packing lists' }).click()
    await expect(page).toHaveURL('/packing-lists')
    expect(state.copyBodies).toHaveLength(1)
  })

  test('aborts a stale overview GET and keeps the confirmed copy when refreshing the overview fails', async ({ context, page, expectConsoleError }) => {
    const state = createState()
    const stale = createDeferred()

    await setup(context, state)
    await openOriginal(page)
    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
    await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    state.overviewGates.push(stale.promise)
    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
    await expect.poll(() => state.overviewRequests).toBe(2)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    const dialog = await openCopy(page)
    const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/user/packing-lists'))

    state.overviewStatus = 500

    const refreshFailure = expectConsoleError(/Failed to load packing lists:/u)

    try {
      await dialog.getByRole('button', { name: 'Create copy' }).click()

      const request = await failed

      expect(request.failure()?.errorText).toMatch(/ERR_ABORTED/u)
      await expect(page).toHaveURL(`/packing-lists/${copyId}`)

      await refreshFailure

      stale.resolve()

      const retryFailure = expectConsoleError(/Failed to load packing lists:/u)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()

      await retryFailure

      await expect(page.getByRole('link', { name: /Alpine weekend — copy/iu })).toBeVisible()
      await expect(page.getByRole('alert')).toHaveText('Could not refresh packing lists. The lists below may be out of date.')
    } finally {
      stale.resolve()
    }
  })

  test('keeps copying locked on reopening and does not redirect when an abandoned dialog finishes', async ({ context, page }) => {
    const state = createState()
    const gate = createDeferred()

    state.copyReplies.push({ gate: gate.promise })
    await setup(context, state)
    await openOriginal(page)

    const dialog = await openCopy(page)

    try {
      await dialog.getByRole('button', { name: 'Create copy' }).click()
      await expect.poll(() => state.copyBodies.length).toBe(1)
      await page.goBack()
      await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()
      await page.getByRole('link', { name: /Alpine weekend/iu }).click()
      await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toHaveAttribute('aria-busy', 'true')
      await expect(page.locator('[inert]').filter({ has: page.getByRole('checkbox') })).toHaveCount(1)
      gate.resolve()
      await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeEnabled()
      await expect(page).toHaveURL(`/packing-lists/${originalId}`)
      expect(state.copyBodies).toHaveLength(1)
    } finally {
      gate.resolve()
    }
  })

  test('does not redirect when a copy response arrives after logout', async ({ context, page }) => {
    const state = createState()
    const gate = createDeferred()

    state.copyReplies.push({ gate: gate.promise })
    await setup(context, state)

    await mockAccountUser(context, {
      email: null,
      isAdmin: false,
      isGuest: true,
      isTwitchLinked: false,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
    })

    await context.route('**/api/auth/logout', async route => {
      await route.fulfill({
        status: 204,
        body: ''
      })
    })

    await openOriginal(page)

    const dialog = await openCopy(page)

    try {
      await dialog.getByRole('button', { name: 'Create copy' }).click()
      await expect.poll(() => state.copyBodies.length).toBe(1)
      await page.goBack()
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: 'Log out' }).click()
      await expect(page).toHaveURL('/login')

      const response = page.waitForResponse(incoming => incoming.url().endsWith('/copy'))

      gate.resolve()

      await response

      await expect(page).toHaveURL('/login')
    } finally {
      gate.resolve()
    }
  })
})
