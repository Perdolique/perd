import { expect, test, type BrowserContext, type Page, type Response, type Route } from '@playwright/test'
import { URL } from 'node:url'

interface MyGearRecord {
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
  myGearRows: MyGearRecord[];
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
const myGearEntryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'
const myGearRowId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'

function createMyGearRecord(): MyGearRecord {
  return {
    createdAt: '2026-04-03T08:30:00.000Z',
    id: myGearRowId,

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

function createMyGearEntry(myGearRow: MyGearRecord): PackingListEntry {
  return {
    createdAt: '2026-04-03T09:02:00.000Z',
    customName: null,
    id: myGearEntryId,

    inventory: {
      brand: myGearRow.item.brand.name,
      category: myGearRow.item.category.name,
      inventoryId: myGearRow.id,
      itemName: myGearRow.item.name
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

    const myGearRow = state.myGearRows.find((row) => row.id === requestBody.inventoryId)

    expect(requestBody).toStrictEqual({
      inventoryId: myGearRowId
    })
    expect(myGearRow).toBeDefined()

    if (myGearRow === undefined) {
      throw new Error('Expected my gear row to exist')
    }

    const entry = createMyGearEntry(myGearRow)
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

async function mockMyGearRoutes(context: BrowserContext, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/gear**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())

    if (request.method() === 'GET' && requestUrl.pathname === '/api/user/gear') {
      await route.fulfill({
        json: state.myGearRows
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
  await sidebar.getByRole('link', { name: 'Packing lists' }).click()
}

async function openPackingListDetail(page: Page): Promise<void> {
  await page.goto(`/login?redirectTo=/packing-lists/${packingListId}`)
  await page.getByRole('button', { name: 'Guest' }).click()
}

test.describe('Packing list shell', () => {
  test('should create an empty list from the empty state in planning mode', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      myGearRows: [],
      rows: []
    }

    await mockAuth(context)
    await mockMyGearRoutes(context, state)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { level: 1, name: 'Packing lists', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No packing lists yet.' })).toBeVisible()

    await page.getByRole('button', { name: 'New list' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a packing list' })).toBeVisible()
    await page.getByLabel('List name').fill('Alpine weekend')

    const createResponsePromise = page.waitForResponse(isPackingListCreateResponse)
    await page.getByRole('button', { name: 'Create list' }).click()
    const createResponse = await createResponsePromise

    expect(createResponse.status()).toBe(201)

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
    await expect(page.locator('#new-packing-list-entry-name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Planning' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Add custom items or pull from my gear while you build this list.')).toBeVisible()
  })

  test('should open list detail in planning mode from a navigational card', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      myGearRows: [createMyGearRecord()],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockMyGearRoutes(context, state)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
    await expect(page.getByText('Add from my gear')).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Danger zone' })).toBeVisible()
  })

  test('should add custom and my gear entries, then switch to checklist and remove them', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      myGearRows: [createMyGearRecord()],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockMyGearRoutes(context, state)
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

    const myGearPickerRow = page.getByRole('listitem').filter({
      has: page.getByText('PocketRocket Deluxe', { exact: true })
    })
    const myGearCreateResponsePromise = page.waitForResponse(isPackingListEntryCreateResponse)
    await myGearPickerRow.getByRole('button', { name: 'Add', exact: true }).click()
    const myGearCreateResponse = await myGearCreateResponsePromise
    expect(myGearCreateResponse.status()).toBe(201)

    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('My gear · MSR · Stoves')).toBeVisible()
    await expect(myGearPickerRow.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)

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

    await page.getByRole('link', { name: 'Back to packing lists' }).click()

    const listCard = page.getByRole('link', { name: /Alpine weekend/iu })

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(listCard).toContainText('0')
  })

  test('should keep the list when delete is canceled', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      myGearRows: [],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockMyGearRoutes(context, state)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete list' }).click()
    await expect(page.getByRole('heading', { name: 'Delete "Alpine weekend"?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Delete "Alpine weekend"?' })).toBeHidden()
    expect(state.rows).toHaveLength(1)
  })

  test('should delete a list from detail and return to the list', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      myGearRows: [],
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockMyGearRoutes(context, state)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete list' }).click()
    await page.getByRole('button', { name: 'Delete list' }).last().click()

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { name: 'No packing lists yet.' })).toBeVisible()
    expect(state.rows).toHaveLength(0)
  })
})
