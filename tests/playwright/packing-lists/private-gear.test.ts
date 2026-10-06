import type { BrowserContext, Page, Route } from '@playwright/test'
import * as v from 'valibot'
import type { PackingListDetail, PackingListEntry } from '../../../app/types/packing'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred, mockGuestLogin } from '../fixtures/gear-library-entry-list.fixtures.ts'

interface PrivateGearState {
  details: Map<string, PackingListDetail>;
  failNextPack: boolean;
  name: string;
  createBodies: unknown[];
  packRequests: number;
  sequence: number;
  staleGate: Promise<void> | null;
}

const firstId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const secondId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const gearId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const initialDate = '2026-10-06T08:00:00.000Z'

function createDetail(id: string, name: string): PackingListDetail {
  return {
    id,
    name,
    entries: [],
    createdAt: initialDate,
    updatedAt: initialDate
  }
}

function requiredDetail(state: PrivateGearState, id: string): PackingListDetail {
  const detail = state.details.get(id)

  if (detail === undefined) {
    throw new Error('Expected a fixture packing list')
  }

  return detail
}

function liveEntries(state: PrivateGearState, detail: PackingListDetail): PackingListEntry[] {
  const entries: PackingListEntry[] = detail.entries.map((entry) => {
    const isPrivateInventory = entry.source === 'inventory' && entry.inventory.source === 'custom'

    if (!isPrivateInventory) {
      return entry
    }

    return {
      ...entry,

      inventory: {
        source: 'custom',
        inventoryId: gearId,
        itemName: state.name
      }
    }
  })

  return entries
}

async function handleListRoute(route: Route, state: PrivateGearState) {
  const request = route.request()
  const requestUrl = request.url()
  const url = new globalThis.URL(requestUrl)
  const parts = url.pathname.split('/')
  const id = parts.at(4)
  const action = parts.at(5)
  const method = request.method()

  if (id === undefined) {
    const savedDetails = state.details.values()
    const details = [...savedDetails]

    const rows = details.map((list) => {
      const packedEntries = list.entries.filter(entry => entry.isPacked)

      return {
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        entryCount: list.entries.length,
        packedCount: packedEntries.length
      }
    })

    await route.fulfill({ json: rows })

    return
  }

  const detail = requiredDetail(state, id)

  if (action === undefined) {
    const entries = liveEntries(state, detail)

    const response = {
      ...detail,
      entries
    }

    await route.fulfill({ json: response })

    return
  }

  if (action === 'available-gear') {
    const search = url.searchParams.get('search') ?? ''

    if (search === 'stale') {
      await state.staleGate

      // The search is aborted by the browser before this gate is released.
      return
    }

    const isUsed = detail.entries.some((entry) => {
      const isSavedGear = entry.source === 'inventory' && entry.inventory.inventoryId === gearId

      return isSavedGear
    })

    const normalizedName = state.name.toLowerCase()
    const normalizedSearch = search.toLowerCase()
    const matches = normalizedName.includes(normalizedSearch)

    const items = isUsed || !matches ? [] : [{
      source: 'custom',
      inventoryId: gearId,
      itemName: state.name
    }]

    await route.fulfill({ json: {
      items,
      nextPage: null
    } })

    return
  }

  const entryId = parts.at(6)

  if (method === 'POST') {
    const raw: unknown = request.postDataJSON()
    const bodySchema = v.object({ inventoryId: v.string() })
    const body = v.parse(bodySchema, raw)

    state.createBodies.push(raw)

    state.sequence += 1

    const hexadecimalSequence = state.sequence.toString(16)
    const suffix = hexadecimalSequence.padStart(2, '0')
    const createdId = `0195f6e8-8f44-74f6-bc9a-5c8f7df477${suffix}`

    const entry: PackingListEntry = {
      id: createdId,
      createdAt: initialDate,
      updatedAt: initialDate,
      customName: null,
      isPacked: false,
      source: 'inventory',

      inventory: {
        source: 'custom',
        inventoryId: body.inventoryId,
        itemName: state.name
      }
    }

    detail.entries.push(entry)

    await route.fulfill({
      status: 201,

      json: {
        entry,
        packingListUpdatedAt: detail.updatedAt
      }
    })

    return
  }

  if (entryId === undefined) {
    throw new Error('Expected a fixture entry ID')
  }

  state.sequence += 1

  const timestamp = Date.parse(initialDate) + state.sequence * 1000
  const date = new Date(timestamp)
  const updatedAt = date.toISOString()

  if (method === 'DELETE') {
    const remainingEntries = detail.entries.filter(entry => entry.id !== entryId)

    detail.entries = remainingEntries
    detail.updatedAt = updatedAt

    await route.fulfill({ json: {
      deletedEntryId: entryId,
      packingListUpdatedAt: updatedAt
    } })

    return
  }

  state.packRequests += 1

  if (state.failNextPack) {
    state.failNextPack = false

    await route.fulfill({
      status: 500,
      json: { message: 'Private database details' }
    })

    return
  }

  const raw: unknown = request.postDataJSON()
  const bodySchema = v.object({ isPacked: v.boolean() })
  const body = v.parse(bodySchema, raw)
  const entries = liveEntries(state, detail)
  const entry = entries.find(row => row.id === entryId)

  if (entry === undefined) {
    throw new Error('Expected a fixture entry')
  }

  const updated = {
    ...entry,
    isPacked: body.isPacked,
    updatedAt
  }

  const updatedEntries = detail.entries.map((row) => {
    const updatedRow = row.id === entryId ? updated : row

    return updatedRow
  })

  detail.entries = updatedEntries
  detail.updatedAt = updatedAt

  await route.fulfill({ json: {
    entry: updated,
    packingListUpdatedAt: updatedAt
  } })
}

async function mockPrivateGear(context: BrowserContext) {
  const first = createDetail(firstId, 'First trip')
  const second = createDetail(secondId, 'Second trip')
  const details = new Map([[firstId, first], [secondId, second]])

  const state: PrivateGearState = {
    details,
    failNextPack: false,
    name: 'DIY Stove',
    createBodies: [],
    packRequests: 0,
    sequence: 0,
    staleGate: null
  }

  await mockGuestLogin(context)
  await context.route('**/api/user/packing-lists**', async route => handleListRoute(route, state))

  await context.route(/\/api\/user\/gear(?:\/[^/]+)?$/u, async (route) => {
    const request = route.request()
    const method = request.method()

    if (method === 'PATCH') {
      const raw: unknown = request.postDataJSON()
      const bodySchema = v.object({ customName: v.string() })
      const body = v.parse(bodySchema, raw)

      state.name = body.customName
    }

    if (method === 'DELETE') {
      const savedDetails = state.details.values()
      const lists = [...savedDetails]
      const isUsed = lists.some(detail => detail.entries.length > 0)
      const status = isUsed ? 409 : 204

      await route.fulfill({ status })

      return
    }

    const gear = {
      id: gearId,
      source: 'custom',
      customName: state.name,
      createdAt: initialDate
    }

    const json = method === 'GET' ? [gear] : gear

    await route.fulfill({ json })
  })

  return state
}

async function signIn(page: Page, path = '/packing-lists') {
  const redirectTo = encodeURIComponent(path)
  const loginPath = `/login?redirectTo=${redirectTo}`

  await page.goto(loginPath)
  await waitForInitialEmailSignInTurnstile(page)

  await page.getByRole('button', {
    name: 'Continue as guest',
    exact: true
  }).click()
}

async function openTrip(page: Page, name: string) {
  await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()

  const namePattern = new RegExp(name, 'u')

  await page.getByRole('link', { name: namePattern }).click()

  await expect(page.getByRole('heading', {
    name,
    exact: true
  })).toBeVisible()
}

test.describe('Private My gear in packing lists', () => {
  test('reuses saved gear in two trips, retries packing, keeps live names, and protects references', async ({ context, page, expectConsoleError }) => {
    const state = await mockPrivateGear(context)

    await test.step('add saved gear to the first trip and retry a failed packed change', async () => {
      await signIn(page)
      await page.getByRole('link', { name: /First trip/u }).click()
      await page.getByRole('textbox', { name: 'Find an item' }).fill('DIY')

      const savedResult = page.getByRole('button', { name: /DIY Stove.*Custom gear · My gear.*Add/u })

      await expect(savedResult).toBeVisible()
      await savedResult.click()
      await expect(page.getByRole('checkbox', { name: /DIY Stove/u })).toBeVisible()
      expect(state.createBodies).toStrictEqual([{ inventoryId: gearId }])

      state.failNextPack = true

      const checkbox = page.getByRole('checkbox', { name: /DIY Stove/u })

      await checkbox.check()
      await expect(page.getByRole('alert')).toContainText('Could not update DIY Stove. Try again.')
      await expect(checkbox).not.toBeChecked()
      await expect(page.getByRole('status')).toHaveText('0 of 1 packed')
      await checkbox.focus()
      await page.keyboard.press('Space')
      await expect(checkbox).toBeChecked()
      await expect(checkbox).toBeFocused()
      await expect(page.getByRole('status')).toContainText('1 of 1 packed · All packed')
      expect(state.packRequests).toBe(2)
    })

    await test.step('reuse the same saved record in a second trip and reload it', async () => {
      await openTrip(page, 'Second trip')

      const savedResult = page.getByRole('button', { name: /DIY Stove.*Custom gear · My gear.*Add/u })

      await savedResult.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('checkbox', { name: /DIY Stove/u })).not.toBeChecked()
      expect(state.createBodies).toStrictEqual([{ inventoryId: gearId }, { inventoryId: gearId }])
      await page.reload()
      await waitForInitialEmailSignInTurnstile(page)

      await page.getByRole('button', {
        name: 'Continue as guest',
        exact: true
      }).click()

      await expect(page.getByRole('checkbox', { name: /DIY Stove/u })).not.toBeChecked()
      await openTrip(page, 'First trip')
      await expect(page.getByRole('checkbox', { name: /DIY Stove/u })).toBeChecked()
    })

    await test.step('rename in My gear and explain blocked deletion', async () => {
      await page.getByTestId('shell-sidebar').getByRole('link', {
        name: 'My gear',
        exact: true
      }).click()

      const gearSelector = `[data-gear-id="${gearId}"]`
      const card = page.locator(gearSelector)

      await card.getByRole('button', { name: /^Actions for /u }).click()

      await card.getByRole('menuitem', {
        name: 'Rename',
        exact: true
      }).click()

      const rename = page.getByRole('dialog', { name: 'Rename custom gear' })

      await rename.getByRole('textbox', { name: 'Gear name' }).fill('Renamed Stove')

      await rename.getByRole('button', {
        name: 'Save name',
        exact: true
      }).click()

      await expect(rename).not.toBeVisible()
      await card.getByRole('button', { name: /^Actions for /u }).click()

      await card.getByRole('menuitem', {
        name: 'Remove',
        exact: true
      }).click()

      const removal = page.getByRole('dialog', { name: 'Remove custom gear' })
      const failure = expectConsoleError(/Failed to remove gear/u)

      await removal.getByRole('button', {
        name: 'Remove gear',
        exact: true
      }).click()

      await failure

      await expect(removal.getByRole('alert')).toHaveText('This gear is used in a packing list. Remove it from all lists first.')
      await page.keyboard.press('Escape')
    })

    await test.step('remove only one reference and preserve the other trip and My gear', async () => {
      await openTrip(page, 'First trip')
      await expect(page.getByRole('checkbox', { name: /Renamed Stove/u })).toBeChecked()

      await page.getByRole('button', {
        name: 'Remove Renamed Stove',
        exact: true
      }).click()

      await expect(page.getByRole('checkbox')).toHaveCount(0)
      await expect(page.getByRole('status')).toHaveText('0 items')
      await openTrip(page, 'Second trip')
      await expect(page.getByRole('checkbox', { name: /Renamed Stove/u })).not.toBeChecked()
      await expect(page.getByRole('status')).toHaveText('0 of 1 packed')

      await page.getByTestId('shell-sidebar').getByRole('link', {
        name: 'My gear',
        exact: true
      }).click()

      const gearSelector = `[data-gear-id="${gearId}"]`
      const card = page.locator(gearSelector)

      await expect(card.getByText('Renamed Stove', { exact: true })).toBeVisible()
    })
  })

  test('cancels an obsolete search before rendering current private gear', async ({ context, page }) => {
    const state = await mockPrivateGear(context)
    const gate = createDeferred()

    state.staleGate = gate.promise

    await signIn(page)
    await page.getByRole('link', { name: /First trip/u }).click()

    const input = page.getByRole('textbox', { name: 'Find an item' })

    const staleRequest = page.waitForRequest((request) => {
      const requestUrl = request.url()
      const url = new globalThis.URL(requestUrl)
      const search = url.searchParams.get('search')

      return search === 'stale'
    })

    try {
      await input.fill('stale')

      const request = await staleRequest
      const failed = page.waitForEvent('requestfailed', { predicate: candidate => candidate === request })

      await input.fill('DIY')

      await failed

      expect(request.failure()?.errorText).toBe('net::ERR_ABORTED')
      await expect(page.getByRole('button', { name: /DIY Stove.*Custom gear · My gear.*Add/u })).toBeVisible()
    } finally {
      gate.resolve()
    }
  })
})
