import { expect, test, type BrowserContext, type Page, type Response, type Route } from '@playwright/test'
import { URL } from 'node:url'

interface InventoryRecord {
  createdAt: string;
  id: string;

  item: {
    brand: {
      name: string;
      slug: string;
    };

    category: {
      name: string;
      slug: string;
    };

    id: string;
    name: string;
  };
}

interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListEntry {
  createdAt: string;
  customName: string | null;
  id: string;

  inventory?: {
    brand: string;
    category: string;
    inventoryId: string;
    itemName: string;
  };

  isPacked: boolean;
  source: 'custom' | 'inventory';
  updatedAt: string;
}

interface PackingListDetail {
  createdAt: string;
  entries: PackingListEntry[];
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListRouteState {
  createRequests: number;
  createShouldFail: boolean;
  deleteShouldFail: boolean;
  inventoryRows: InventoryRecord[];
  rows: PackingListDetail[];
}

interface CreateEntryRequestBody {
  customName?: string;
  inventoryId?: string;
}

interface ToggleEntryRequestBody {
  isPacked: boolean;
}

const packingListId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const customEntryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
const inventoryEntryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'
const inventoryRowId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'

function createInventoryRecord(): InventoryRecord {
  return {
    createdAt: '2026-04-03T08:30:00.000Z',
    id: inventoryRowId,

    item: {
      brand: {
        name: 'MSR',
        slug: 'msr'
      },

      category: {
        name: 'Stoves',
        slug: 'stoves'
      },

      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f1',
      name: 'PocketRocket Deluxe'
    }
  }
}

function createPackingList(name: string): PackingListDetail {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    entries: [],
    id: packingListId,
    name,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
}

function createPackingListSummary(row: PackingListDetail): PackingListSummary {
  return {
    createdAt: row.createdAt,
    entryCount: row.entries.length,
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt
  }
}

function createCustomEntry(customName: string): PackingListEntry {
  return {
    createdAt: '2026-04-03T09:01:00.000Z',
    customName,
    id: customEntryId,
    isPacked: false,
    source: 'custom',
    updatedAt: '2026-04-03T09:01:00.000Z'
  }
}

function createInventoryEntry(inventoryRow: InventoryRecord): PackingListEntry {
  return {
    createdAt: '2026-04-03T09:02:00.000Z',
    customName: null,
    id: inventoryEntryId,

    inventory: {
      brand: inventoryRow.item.brand.name,
      category: inventoryRow.item.category.name,
      inventoryId: inventoryRow.id,
      itemName: inventoryRow.item.name
    },

    isPacked: false,
    source: 'inventory',
    updatedAt: '2026-04-03T09:02:00.000Z'
  }
}

function isPackingListCreateResponse(response: Response): boolean {
  const responseUrl = new URL(response.url())
  const isPackingListCollectionResponse = responseUrl.pathname === '/api/user/packing-lists'
  const isPostRequest = response.request().method() === 'POST'

  return isPackingListCollectionResponse && isPostRequest
}

function isPackingListEntryCreateResponse(response: Response): boolean {
  const responseUrl = new URL(response.url())
  const isEntryCollectionResponse = responseUrl.pathname === `/api/user/packing-lists/${packingListId}/entries`
  const isPostRequest = response.request().method() === 'POST'

  return isEntryCollectionResponse && isPostRequest
}

function isCreateEntryRequestBody(value: unknown): value is CreateEntryRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return true
}

function isToggleEntryRequestBody(value: unknown): value is ToggleEntryRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (('isPacked' in value) === false) {
    return false
  }

  return typeof value.isPacked === 'boolean'
}

async function fulfillPackingListCollectionRoute(route: Route, page: Page, state: PackingListRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'GET') {
    await route.fulfill({
      json: state.rows.map(createPackingListSummary)
    })

    return
  }

  if (method === 'POST') {
    state.createRequests += 1

    expect(request.postDataJSON()).toStrictEqual({
      name: 'Alpine weekend'
    })

    await page.waitForTimeout(250)

    if (state.createShouldFail === true) {
      await route.fulfill({
        status: 500,
        json: {}
      })

      return
    }

    const createdList = createPackingList('Alpine weekend')
    state.rows = [createdList]

    await route.fulfill({
      status: 201,
      json: {
        createdAt: createdList.createdAt,
        id: createdList.id,
        name: createdList.name,
        updatedAt: createdList.updatedAt
      }
    })

    return
  }

  await route.abort()
}

async function fulfillPackingListDetailRoute(route: Route, page: Page, state: PackingListRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()
  const requestUrl = new URL(request.url())
  const pathParts = requestUrl.pathname.split('/')
  const entryId = pathParts.at(-1)
  const packingList = state.rows.find((row) => requestUrl.pathname.includes(`/api/user/packing-lists/${row.id}`))
  const isEntryCollectionRoute = packingList !== undefined && requestUrl.pathname.endsWith(`/api/user/packing-lists/${packingList.id}/entries`)
  const isEntryDetailRoute = packingList !== undefined && requestUrl.pathname.includes(`/api/user/packing-lists/${packingList.id}/entries/`)

  if (isEntryCollectionRoute && method === 'POST') {
    await page.waitForTimeout(250)

    const requestBody: unknown = request.postDataJSON()

    expect(isCreateEntryRequestBody(requestBody)).toBe(true)

    if (isCreateEntryRequestBody(requestBody) === false) {
      throw new Error('Expected packing list entry create body')
    }

    if (requestBody.customName !== undefined) {
      expect(requestBody).toStrictEqual({
        customName: 'Rain shell'
      })

      const entry = createCustomEntry(requestBody.customName)
      packingList.entries = [...packingList.entries, entry]
      packingList.updatedAt = '2026-04-03T09:02:00.000Z'

      await route.fulfill({
        status: 201,
        json: {
          entry,
          packingListUpdatedAt: packingList.updatedAt
        }
      })

      return
    }

    const inventoryRow = state.inventoryRows.find((row) => row.id === requestBody.inventoryId)

    expect(requestBody).toStrictEqual({
      inventoryId: inventoryRowId
    })
    expect(inventoryRow).toBeDefined()

    if (inventoryRow === undefined) {
      throw new Error('Expected inventory row to exist')
    }

    const entry = createInventoryEntry(inventoryRow)
    packingList.entries = [...packingList.entries, entry]
    packingList.updatedAt = '2026-04-03T09:03:00.000Z'

    await route.fulfill({
      status: 201,
      json: {
        entry,
        packingListUpdatedAt: packingList.updatedAt
      }
    })

    return
  }

  if (isEntryDetailRoute && method === 'PATCH') {
    await page.waitForTimeout(250)

    const requestBody: unknown = request.postDataJSON()

    expect(isToggleEntryRequestBody(requestBody)).toBe(true)

    if (isToggleEntryRequestBody(requestBody) === false) {
      throw new Error('Expected packing list entry toggle body')
    }

    const entry = packingList.entries.find((row) => row.id === entryId)

    if (entry === undefined) {
      await route.fulfill({
        status: 404,
        json: {}
      })

      return
    }

    const updatedEntry: PackingListEntry = {
      ...entry,
      isPacked: requestBody.isPacked,
      updatedAt: '2026-04-03T09:04:00.000Z'
    }

    packingList.entries = packingList.entries.map((row) => row.id === updatedEntry.id ? updatedEntry : row)
    packingList.updatedAt = '2026-04-03T09:04:30.000Z'

    await route.fulfill({
      json: {
        entry: updatedEntry,
        packingListUpdatedAt: packingList.updatedAt
      }
    })

    return
  }

  if (isEntryDetailRoute && method === 'DELETE') {
    await page.waitForTimeout(250)

    if (entryId !== undefined) {
      packingList.entries = packingList.entries.filter((row) => row.id !== entryId)
    }

    packingList.updatedAt = '2026-04-03T09:05:00.000Z'

    await route.fulfill({
      json: {
        deletedEntryId: entryId,
        packingListUpdatedAt: packingList.updatedAt
      }
    })

    return
  }

  if (method === 'GET') {
    if (packingList === undefined) {
      await route.fulfill({
        status: 404,
        json: {}
      })

      return
    }

    await route.fulfill({
      json: packingList
    })

    return
  }

  if (method === 'DELETE') {
    await page.waitForTimeout(250)

    if (state.deleteShouldFail === true) {
      await route.fulfill({
        status: 500,
        json: {}
      })

      return
    }

    if (packingList !== undefined) {
      state.rows = state.rows.filter((row) => row.id !== packingList.id)
    }

    await route.fulfill({
      status: 204,
      body: ''
    })

    return
  }

  await route.abort()
}

async function mockPackingListRoutes(context: BrowserContext, page: Page, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/packing-lists**', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (requestUrl.pathname === '/api/user/packing-lists') {
      await fulfillPackingListCollectionRoute(route, page, state)

      return
    }

    await fulfillPackingListDetailRoute(route, page, state)
  })
}

async function mockInventoryRoutes(context: BrowserContext, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/equipment**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())

    if (request.method() === 'GET' && requestUrl.pathname === '/api/user/equipment') {
      await route.fulfill({
        json: state.inventoryRows
      })

      return
    }

    await route.abort()
  })
}

async function mockAuth(context: BrowserContext): Promise<void> {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })
}

async function openPackingLists(page: Page): Promise<void> {
  await page.goto('/login?redirectTo=/')
  await page.getByRole('button', { name: 'Guest' }).click()

  const sidebar = page.getByTestId('shell-sidebar')
  await sidebar.getByRole('link', { name: 'Packs' }).click()
}

async function openPackingListDetail(page: Page): Promise<void> {
  await page.goto(`/login?redirectTo=/packs/${packingListId}`)
  await page.getByRole('button', { name: 'Guest' }).click()
}

test.describe('Packing list shell', () => {
  test('should create an empty pack from the empty state in planning mode', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      inventoryRows: [],
      rows: []
    }

    await mockAuth(context)
    await mockInventoryRoutes(context, state)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(page.getByRole('heading', { level: 1, name: 'Packs', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No packs yet.' })).toBeVisible()

    await page.getByRole('button', { name: 'New pack' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeVisible()
    await page.getByLabel('Pack name').fill('Alpine weekend')

    const createResponsePromise = page.waitForResponse(isPackingListCreateResponse)
    await page.getByRole('button', { name: 'Create pack' }).click()
    const createResponse = await createResponsePromise

    expect(createResponse.status()).toBe(201)

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
    await expect(page.locator('#new-packing-list-entry-name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Planning' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Add custom items or pull from saved gear while you build this pack.')).toBeVisible()
  })

  test('should open pack detail in planning mode from a navigational card', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      inventoryRows: [createInventoryRecord()],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockInventoryRoutes(context, state)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
    await expect(page.getByText('Add from inventory')).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible()
  })

  test('should add custom and inventory entries, then switch to checklist and remove them', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      inventoryRows: [createInventoryRecord()],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockInventoryRoutes(context, state)
    await mockPackingListRoutes(context, page, state)
    await openPackingListDetail(page)

    const customItemInput = page.locator('#new-packing-list-entry-name')
    await customItemInput.fill('Rain shell')

    const customCreateResponsePromise = page.waitForResponse(isPackingListEntryCreateResponse)
    await page.getByRole('button', { name: 'Add custom item' }).click()
    const customCreateResponse = await customCreateResponsePromise
    expect(customCreateResponse.status()).toBe(201)

    const rainShellRow = page.getByRole('listitem').filter({
      has: page.getByText('Rain shell', { exact: true })
    })

    await expect(page.getByText('Rain shell')).toBeVisible()
    await expect(rainShellRow.getByText('Custom item', { exact: true })).toBeVisible()
    await expect(customItemInput).toHaveValue('')

    const inventoryPickerRow = page.getByRole('listitem').filter({
      has: page.getByText('PocketRocket Deluxe', { exact: true })
    })
    const inventoryCreateResponsePromise = page.waitForResponse(isPackingListEntryCreateResponse)
    await inventoryPickerRow.getByRole('button', { name: 'Add', exact: true }).click()
    const inventoryCreateResponse = await inventoryCreateResponsePromise
    expect(inventoryCreateResponse.status()).toBe(201)

    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('Saved gear · MSR · Stoves')).toBeVisible()
    await expect(inventoryPickerRow.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Checklist' }).click()

    await expect(page.getByRole('heading', { name: 'Checklist' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Checklist' })).toHaveAttribute('aria-pressed', 'true')

    const rainShellCheckbox = page.getByRole('checkbox', { name: 'Mark packed: Rain shell' })
    await rainShellCheckbox.click()

    await expect(page.getByRole('checkbox', { name: 'Mark unpacked: Rain shell' })).toBeChecked()
    await expect(page.getByText('1 of 2 packed')).toBeVisible()

    const removeButtons = page.getByRole('button', { name: 'Remove' })
    await removeButtons.nth(0).click()
    await removeButtons.nth(0).click()

    await expect(page.getByText('Rain shell')).toHaveCount(0)
    await expect(page.getByText('PocketRocket Deluxe')).toHaveCount(0)
    await expect(page.getByText('0 of 0 packed')).toBeVisible()
    await expect(page.getByText('Switch to planning mode to add items before packing.')).toBeVisible()

    await page.getByRole('link', { name: 'Back to packs' }).click()

    const packCard = page.getByRole('link', { name: /Alpine weekend/iu })

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(packCard).toContainText('0')
  })

  test('should keep the pack when delete is canceled', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      inventoryRows: [],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockInventoryRoutes(context, state)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete pack' }).click()
    await expect(page.getByRole('heading', { name: 'Delete "Alpine weekend"?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Delete "Alpine weekend"?' })).toBeHidden()
    expect(state.rows).toHaveLength(1)
  })

  test('should delete a pack from detail and return to the list', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      inventoryRows: [],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockInventoryRoutes(context, state)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete pack' }).click()
    await page.getByRole('button', { name: 'Delete pack' }).last().click()

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(page.getByRole('heading', { name: 'No packs yet.' })).toBeVisible()
    expect(state.rows).toHaveLength(0)
  })
})
