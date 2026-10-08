import type { BrowserContext, Page } from '@playwright/test'
import * as v from 'valibot'
import type { PackingListDetail } from '../../../app/types/packing.ts'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'

interface Gate {
  promise: Promise<void>;
  resolve: () => void;
}

function throwUninitializedGate(): never {
  throw new Error('Gate was not initialized')
}

function createGate(): Gate {
  let resolveGate: () => void = throwUninitializedGate

  // oxlint-disable-next-line promise/avoid-new -- The browser test must hold a response until UI assertions finish.
  const promise = new Promise<void>((resolve) => {
    resolveGate = resolve
  })

  return {
    promise,
    resolve: resolveGate
  }
}

interface RouteState {
  detail: PackingListDetail;
  detailStatus: number;
  clearGate: Promise<void> | null;
  clearStatus: number;
  clearRequests: number;
  clearBodies: (string | null)[];
  patchGate: Promise<void> | null;
  patchRequests: number;
  staleDetail: PackingListDetail | null;
  staleOverview: boolean;
}

const listId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const listPath = `/packing-lists/${listId}`
const apiPath = `/api/user/packing-lists/${listId}`
const initialDate = '2026-10-08T10:00:00.000Z'
const savedDate = '2026-10-08T10:00:00.001Z'

const initialEntries = [{
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
  customName: 'Rain jacket',
  source: 'custom',
  isPacked: true,
  createdAt: initialDate,
  updatedAt: initialDate
}, {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
  customName: null,
  source: 'inventory',
  isPacked: true,
  createdAt: initialDate,
  updatedAt: initialDate,

  inventory: {
    source: 'catalog',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477a1',
    itemName: 'Catalog tent',
    brand: 'MSR',
    category: 'Tents'
  }
}, {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3',
  customName: null,
  source: 'inventory',
  isPacked: true,
  createdAt: initialDate,
  updatedAt: initialDate,

  inventory: {
    source: 'custom',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477a2',
    itemName: 'Private stove'
  }
}] as const satisfies PackingListDetail['entries']

function createState(): RouteState {
  return {
    detail: {
      id: listId,
      name: 'Alpine weekend',
      createdAt: initialDate,
      updatedAt: initialDate,
      entries: [...initialEntries]
    },

    detailStatus: 200,
    clearGate: null,
    clearStatus: 200,
    clearRequests: 0,
    clearBodies: [],
    patchGate: null,
    patchRequests: 0,
    staleDetail: null,
    staleOverview: false
  }
}

function clearedEntry(entry: PackingListDetail['entries'][number]) {
  return {
    ...entry,
    isPacked: false,
    updatedAt: savedDate
  }
}

async function setup(context: BrowserContext, state: RouteState) {
  await context.route('**/api/auth/create-session**', async route => {
    await route.fulfill({
      status: 201,

      json: {
        isGuest: true,
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })

  await mockAccountUser(context, {
    email: null,
    isAdmin: false,
    isGuest: true,
    isTwitchLinked: false,
    userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
  })

  await context.route('**/api/user/packing-lists**', async route => {
    const request = route.request()
    const url = new globalThis.URL(request.url())

    if (url.pathname === '/api/user/packing-lists') {
      const packedCount = state.staleOverview ? 3 : state.detail.entries.filter(entry => entry.isPacked).length
      const updatedAt = state.staleOverview ? initialDate : state.detail.updatedAt

      await route.fulfill({ json: [{
        id: listId,
        name: state.detail.name,
        createdAt: initialDate,
        updatedAt,
        entryCount: state.detail.entries.length,
        packedCount
      }] })

      return
    }

    if (url.pathname === `${apiPath}/available-gear`) {
      await route.fulfill({ json: {
        items: [],
        nextPage: null
      } })

      return
    }

    if (url.pathname === `${apiPath}/clear-packed`) {
      state.clearRequests += 1

      state.clearBodies.push(request.postData())

      await state.clearGate

      if (state.clearStatus !== 200) {
        await route.fulfill({
          status: state.clearStatus,
          json: { message: 'private backend error' }
        })

        return
      }

      state.detail = {
        ...state.detail,
        updatedAt: savedDate,
        entries: state.detail.entries.map(clearedEntry)
      }

      await route.fulfill({ json: state.detail })

      return
    }

    if (url.pathname === apiPath && request.method() === 'PATCH') {
      const raw: unknown = request.postDataJSON()
      const { name } = v.parse(v.object({ name: v.string() }), raw)

      state.detail = {
        ...state.detail,
        name,
        updatedAt: '2026-10-08T10:00:00.003Z'
      }

      await route.fulfill({ json: {
        createdAt: state.detail.createdAt,
        id: state.detail.id,
        name,
        updatedAt: state.detail.updatedAt
      } })

      return
    }

    if (url.pathname.startsWith(`${apiPath}/entries/`) && request.method() === 'DELETE') {
      const deletedEntryId = url.pathname.split('/').at(-1)

      state.detail = {
        ...state.detail,
        updatedAt: '2026-10-08T10:00:00.004Z',
        entries: state.detail.entries.filter(entry => entry.id !== deletedEntryId)
      }

      await route.fulfill({ json: {
        deletedEntryId,
        packingListUpdatedAt: state.detail.updatedAt
      } })

      return
    }

    if (url.pathname.startsWith(`${apiPath}/entries/`) && request.method() === 'PATCH') {
      state.patchRequests += 1
      await state.patchGate

      const body: unknown = request.postDataJSON()
      const { isPacked } = v.parse(v.object({ isPacked: v.boolean() }), body)
      const entryId = url.pathname.split('/').at(-1)
      const entry = state.detail.entries.find(current => current.id === entryId)

      if (entry === undefined) {
        throw new Error('Unknown mock entry')
      }

      const patchedDate = '2026-10-08T10:00:00.002Z'

      const saved = {
        ...entry,
        isPacked,
        updatedAt: patchedDate
      }

      state.detail = {
        ...state.detail,
        updatedAt: patchedDate,
        entries: state.detail.entries.map(current => current.id === entryId ? saved : current)
      }

      await route.fulfill({ json: {
        entry: saved,
        packingListUpdatedAt: patchedDate
      } })

      return
    }

    if (url.pathname === apiPath && request.method() === 'GET') {
      if (state.detailStatus === 200) {
        await route.fulfill({ json: state.staleDetail ?? state.detail })
      } else {
        await route.fulfill({
          status: state.detailStatus,
          json: { message: 'private refresh error' }
        })
      }

      return
    }

    throw new Error(`Unexpected packing list request: ${request.method()} ${url.pathname}`)
  })
}

async function openList(page: Page) {
  await page.goto(`/login?redirectTo=${listPath}`)
  await waitForInitialEmailSignInTurnstile(page)

  await page.getByRole('button', {
    name: 'Continue as guest',
    exact: true
  }).click()

  await expect(page.getByRole('heading', {
    name: 'Alpine weekend',
    exact: true
  })).toBeVisible()
}

async function openClear(page: Page) {
  await page.getByRole('button', { name: 'Actions for Alpine weekend' }).click()

  await page.getByRole('menuitem', {
    name: 'Clear packed marks',
    exact: true
  }).click()

  return page.getByRole('dialog', {
    name: 'Clear packed marks',
    exact: true
  })
}

async function showOverview(page: Page) {
  await page.getByTestId('shell-sidebar').getByRole('link', {
    name: 'Packing lists',
    exact: true
  }).click()

  await expect(page.getByRole('heading', {
    name: 'Packing lists',
    exact: true
  })).toBeVisible()
}

async function expectInsideViewport(page: Page) {
  const geometry = await page.getByRole('dialog', {
    name: 'Clear packed marks',
    exact: true
  }).evaluate(element => {
    const bounds = element.getBoundingClientRect()

    const buttons = [...element.querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect()

      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    })

    return {
      left: bounds.left,
      right: bounds.right,
      viewport: globalThis.innerWidth,
      buttons
    }
  })

  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport)

  for (const button of geometry.buttons) {
    expect(button.left).toBeGreaterThanOrEqual(geometry.left)
    expect(button.right).toBeLessThanOrEqual(geometry.right)
    expect(button.width).toBeGreaterThan(0)
    expect(button.height).toBeGreaterThan(0)
  }
}


function prepareEmptyList(state: RouteState, empty: boolean) {
  state.detail.entries = empty ? [] : state.detail.entries.map(clearedEntry)
}

async function dismissDialog(page: Page, dismissal: 'Cancel' | 'Escape' | 'backdrop') {
  if (dismissal === 'Cancel') {
    await page.getByRole('dialog').getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()
  } else if (dismissal === 'Escape') {
    await page.keyboard.press('Escape')
  } else {
    await page.mouse.click(1, 1)
  }
}

async function changeAfterRecovery(page: Page, mutation: 'rename' | 'remove') {
  if (mutation === 'rename') {
    await page.getByRole('button', { name: 'Actions for Alpine weekend' }).click()

    await page.getByRole('menuitem', {
      name: 'Rename',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', {
      name: 'Rename packing list',
      exact: true
    })

    await dialog.getByRole('textbox', {
      name: 'List name',
      exact: true
    }).fill('Next trip')

    await dialog.getByRole('button', {
      name: 'Save name',
      exact: true
    }).click()

    await expect(dialog).toHaveCount(0)
  } else {
    await page.getByRole('button', {
      name: 'Remove Rain jacket',
      exact: true
    }).click()

    await expect(page.getByRole('checkbox', {
      name: 'Rain jacket',
      exact: true
    })).toHaveCount(0)
  }
}

test.describe('Clear packed marks', () => {
  for (const width of [320, 1280]) {
    test(`confirms all entry types, waits for the server, locks dismissal, and restores keyboard focus at ${width}px`, async ({ context, page }) => {
      const state = createState()
      const gate = createGate()

      state.clearGate = gate.promise

      await page.setViewportSize({
        width,
        height: 900
      })

      await setup(context, state)
      await openList(page)

      const actions = page.getByRole('button', { name: 'Actions for Alpine weekend' })

      await actions.focus()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')

      const item = page.getByRole('menuitem', {
        name: 'Clear packed marks',
        exact: true
      })

      await expect(item).toBeFocused()
      await page.keyboard.press('Enter')

      const dialog = page.getByRole('dialog', {
        name: 'Clear packed marks',
        exact: true
      })

      const confirm = dialog.getByRole('button', {
        name: 'Clear packed marks',
        exact: true
      })

      await expect(dialog).toContainText('Clear all packed marks in “Alpine weekend”?')
      await expect(dialog).toContainText('Items and saved gear will not be removed.')
      await expect(confirm).toBeFocused()
      await expectInsideViewport(page)
      await page.keyboard.press('Enter')
      await expect.poll(() => state.clearRequests).toBe(1)
      await expect(confirm).toBeDisabled()

      await expect(dialog.getByRole('button', {
        name: 'Cancel',
        exact: true
      })).toBeDisabled()

      await expect(actions).toBeDisabled()
      await expect(page.locator('[inert]').filter({ has: page.getByText('3 of 3 packed · All packed', { exact: true }) })).toHaveCount(1)
      await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(3)
      await page.keyboard.press('Escape')
      await page.mouse.click(1, 1)
      await expect(dialog).toBeVisible()
      expect(state.clearRequests).toBe(1)
      gate.resolve()
      await expect(dialog).toHaveCount(0)
      await expect(actions).toBeFocused()
      await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
      await expect(page.getByRole('checkbox')).toHaveCount(3)
      await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(0)
      await expect(page.getByText('Rain jacket', { exact: true })).toBeVisible()
      await expect(page.getByText('Catalog tent', { exact: true })).toBeVisible()
      await expect(page.getByText('Private stove', { exact: true })).toBeVisible()
      expect(state.clearBodies).toStrictEqual([null])
    })
  }

  for (const dismissal of ['Cancel', 'Escape', 'backdrop'] as const) {
    test(`cancels by ${dismissal} without sending POST`, async ({ context, page }) => {
      const state = createState()

      await setup(context, state)
      await openList(page)

      const dialog = await openClear(page)

      await dismissDialog(page, dismissal)
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeFocused()
      await expect(page.getByRole('status').filter({ hasText: '3 of 3 packed · All packed' })).toBeVisible()
      expect(state.clearRequests).toBe(0)
    })
  }

  for (const empty of [false, true]) {
    test(`explains the disabled action for empty=${empty}`, async ({ context, page }) => {
      const state = createState()

      prepareEmptyList(state, empty)
      await setup(context, state)
      await openList(page)
      await page.getByRole('button', { name: 'Actions for Alpine weekend' }).click()

      const action = page.getByRole('menuitem', {
        name: 'Clear packed marks',
        exact: true
      })

      await expect(action).toHaveAttribute('aria-disabled', 'true')
      await expect(action).toHaveAttribute('title', 'There are no packed marks to clear.')
      await action.click({ force: true })
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(state.clearRequests).toBe(0)
    })
  }

  test('disables reset while an entry is saving and does not queue it', async ({ context, page }) => {
    const state = createState()
    const gate = createGate()

    state.patchGate = gate.promise

    await setup(context, state)
    await openList(page)

    await page.getByRole('checkbox', {
      name: 'Rain jacket',
      exact: true
    }).uncheck()

    await expect.poll(() => state.patchRequests).toBe(1)
    await page.getByRole('button', { name: 'Actions for Alpine weekend' }).click()

    const action = page.getByRole('menuitem', {
      name: 'Clear packed marks',
      exact: true
    })

    await expect(action).toHaveAttribute('aria-disabled', 'true')
    await expect(action).toHaveAttribute('title', 'Wait for list changes to finish saving.')
    await action.click({ force: true })
    gate.resolve()
    await expect(action).toHaveAttribute('aria-disabled', 'false')
    expect(state.clearRequests).toBe(0)
  })

  test('keeps detail and overview cleared through stale reads, navigation, and reload', async ({ context, page }) => {
    const state = createState()
    const old = state.detail

    await setup(context, state)
    await openList(page)

    const dialog = await openClear(page)

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await expect(dialog).toHaveCount(0)

    state.staleDetail = old
    state.staleOverview = true

    await showOverview(page)
    await expect(page.getByRole('link', { name: /Alpine weekend/u })).toContainText('0 of 3 packed')
    await page.getByRole('link', { name: /Alpine weekend/u }).click()
    await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(0)

    // After a stale read, a new per-entry save must keep the other cleared marks.
    await page.getByRole('checkbox', {
      name: 'Rain jacket',
      exact: true
    }).check()

    await expect.poll(() => state.patchRequests).toBe(1)
    await expect(page.getByRole('status').filter({ hasText: '1 of 3 packed' })).toBeVisible()
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(1)

    state.staleDetail = null
    state.staleOverview = false

    await page.reload()

    // Mocked Guest login does not create a server session, so reload uses the same sign-in again.
    await waitForInitialEmailSignInTurnstile(page)

    await page.getByRole('button', {
      name: 'Continue as guest',
      exact: true
    }).click()

    await expect(page.getByRole('status').filter({ hasText: '1 of 3 packed' })).toBeVisible()
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(1)
  })

  test('shows a safe error, refreshes automatically, and allows a deliberate retry', async ({ context, page, expectConsoleError }) => {
    const state = createState()

    state.clearStatus = 500

    await setup(context, state)
    await openList(page)

    const dialog = await openClear(page)
    const error = expectConsoleError(/Failed to clear packing list packed marks:/u)

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await error

    await expect(dialog.getByRole('alert')).toContainText('Could not confirm the reset. The list has been refreshed.')
    await expect(dialog).not.toContainText('private backend error')
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(3)
    expect(state.clearRequests).toBe(1)

    state.clearStatus = 200

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
    expect(state.clearRequests).toBe(2)
  })

  test('marks failed recovery unconfirmed, keeps reset disabled, and recovers through Refresh list', async ({ context, page, expectConsoleError }) => {
    const state = createState()

    state.clearStatus = 500

    await setup(context, state)
    await openList(page)

    state.detailStatus = 500

    const dialog = await openClear(page)
    const resetError = expectConsoleError(/Failed to clear packing list packed marks:/u)
    const refreshError = expectConsoleError(/Failed to refresh packing list packed state:/u)

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await Promise.all([resetError, refreshError])
    await expect(dialog.getByRole('alert')).toContainText('Could not confirm the packed marks.')

    await expect(dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    })).toBeDisabled()

    await expect(dialog.getByRole('button', {
      name: 'Refresh list',
      exact: true
    })).toBeEnabled()

    state.detailStatus = 200
    state.clearStatus = 200

    await dialog.getByRole('button', {
      name: 'Refresh list',
      exact: true
    }).click()

    await expect(dialog.getByRole('alert')).toHaveCount(0)

    await expect(dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    })).toBeFocused()

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
  })

  test('offers page recovery after dismissal and focuses Actions when a refresh confirms a completed reset', async ({ context, page, expectConsoleError }) => {
    const state = createState()

    state.clearStatus = 500

    await setup(context, state)
    await openList(page)

    state.detailStatus = 500

    const dialog = await openClear(page)
    const resetError = expectConsoleError(/Failed to clear packing list packed marks:/u)
    const refreshError = expectConsoleError(/Failed to refresh packing list packed state:/u)

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await Promise.all([resetError, refreshError])

    await expect(dialog.getByRole('button', {
      name: 'Refresh list',
      exact: true
    })).toBeFocused()

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByText('Packed marks are unconfirmed. Refresh the list before making changes.', { exact: true })).toBeVisible()
    await expect(page.locator('[inert] input[type="checkbox"]')).toHaveCount(3)
    await showOverview(page)
    await expect(page.getByRole('link', { name: /Alpine weekend/u })).toContainText('Packing progress unconfirmed')

    state.detailStatus = 200

    await page.getByRole('link', { name: /Alpine weekend/u }).click()

    await expect(page.getByRole('button', {
      name: 'Refresh list',
      exact: true
    })).toBeVisible()

    state.detailStatus = 200
    state.detail = {
      ...state.detail,
      updatedAt: savedDate,
      entries: state.detail.entries.map(clearedEntry)
    }

    await page.getByRole('button', {
      name: 'Refresh list',
      exact: true
    }).click()

    await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeFocused()
    expect(state.clearRequests).toBe(1)
  })

  test('focuses Cancel when dialog recovery finds no remaining packed marks', async ({ context, page, expectConsoleError }) => {
    const state = createState()

    state.clearStatus = 500

    await setup(context, state)
    await openList(page)

    state.detailStatus = 500

    const dialog = await openClear(page)
    const resetError = expectConsoleError(/Failed to clear packing list packed marks:/u)
    const refreshError = expectConsoleError(/Failed to refresh packing list packed state:/u)

    await dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    }).click()

    await Promise.all([resetError, refreshError])

    state.detailStatus = 200
    state.detail = {
      ...state.detail,
      updatedAt: savedDate,
      entries: state.detail.entries.map(clearedEntry)
    }

    await dialog.getByRole('button', {
      name: 'Refresh list',
      exact: true
    }).click()

    await expect(dialog.getByRole('button', {
      name: 'Clear packed marks',
      exact: true
    })).toBeDisabled()

    await expect(dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    })).toBeFocused()

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByRole('button', { name: 'Actions for Alpine weekend' })).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: '0 of 3 packed' })).toBeVisible()
  })

  for (const mutation of ['rename', 'remove'] as const) {
    const expectedEntries = mutation === 'rename' ? 3 : 2
    const expectedTitle = mutation === 'rename' ? 'Next trip' : 'Alpine weekend'

    test(`keeps refreshed marks after a lost reset response followed by ${mutation}`, async ({ context, page, expectConsoleError }) => {
      const state = createState()
      const gate = createGate()

      state.clearStatus = 500
      state.clearGate = gate.promise

      await setup(context, state)
      await openList(page)

      const dialog = await openClear(page)
      const resetError = expectConsoleError(/Failed to clear packing list packed marks:/u)

      await dialog.getByRole('button', {
        name: 'Clear packed marks',
        exact: true
      }).click()

      await expect.poll(() => state.clearRequests).toBe(1)

      // The reset committed, but its POST reply was lost. The subsequent GET is authoritative.
      state.detail = {
        ...state.detail,
        updatedAt: savedDate,
        entries: state.detail.entries.map(clearedEntry)
      }

      gate.resolve()

      await resetError

      await expect(dialog.getByRole('alert')).toContainText('The list has been refreshed.')

      await expect(dialog.getByRole('button', {
        name: 'Cancel',
        exact: true
      })).toBeFocused()

      await dialog.getByRole('button', {
        name: 'Cancel',
        exact: true
      }).click()

      await changeAfterRecovery(page, mutation)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expectedTitle)
      await expect(page.getByRole('status').filter({ hasText: `0 of ${expectedEntries} packed` })).toBeVisible()
      await expect(page.getByRole('checkbox')).toHaveCount(expectedEntries)
      await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(0)
      await showOverview(page)
      await expect(page.getByRole('link', { name: new RegExp(expectedTitle, 'u') })).toContainText(`0 of ${expectedEntries} packed`)
    })
  }

})
