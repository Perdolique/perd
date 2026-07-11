import { expect, test, type BrowserContext, type Page, type Request, type Response, type Route } from '@playwright/test'

interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListEntryInventory {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntryBase {
  createdAt: string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: string;
}

interface PackingListCustomEntry extends PackingListEntryBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryBase {
  inventory: PackingListEntryInventory;
  source: 'inventory';
}

type PackingListEntry = PackingListCustomEntry | PackingListInventoryEntry

interface PackingListDetail {
  createdAt: string;
  entries: PackingListEntry[];
  id: string;
  name: string;
  updatedAt: string;
}

interface AvailableGearItem {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface AvailableGearResponse {
  items: AvailableGearItem[];
  nextPage: number | null;
}

interface AvailableGearRequest {
  page: number;
  search: string;
}

interface PackingListEntryMutationResponse {
  entry: PackingListEntry;
  packingListUpdatedAt: string;
}

interface PackingListRouteState {
  availableGearRequests: AvailableGearRequest[];
  availableGearResponses: Map<string, AvailableGearResponse[]>;
  createRequests: number;
  detail: PackingListDetail;
  detailRequests: number;
  entryCreateBodies: unknown[];
  entryCreateResponses: PackingListEntryMutationResponse[];
  entryDeleteRequests: number;
  getDelayMs: number;
  getRequests: number;
  rows: PackingListSummary[];
}

const packingListId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const pocketRocketInventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const whisperLiteInventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'

function createPackingListSummary(name: string): PackingListSummary {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    entryCount: 0,
    id: packingListId,
    name,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
}

function createPackingListDetail(name: string, entries: PackingListEntry[] = []): PackingListDetail {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    entries,
    id: packingListId,
    name,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
}

function createPackingListEntries(): PackingListEntry[] {
  return [{
    createdAt: '2026-04-03T09:01:00.000Z',
    customName: 'Rain jacket',
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
    isPacked: false,
    source: 'custom',
    updatedAt: '2026-04-03T09:01:00.000Z'
  }, {
    createdAt: '2026-04-03T09:02:00.000Z',
    customName: null,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

    inventory: {
      brand: 'MSR',
      category: 'Stoves',
      inventoryId: pocketRocketInventoryId,
      itemName: 'PocketRocket Deluxe'
    },

    isPacked: true,
    source: 'inventory',
    updatedAt: '2026-04-03T09:02:00.000Z'
  }]
}

function createAvailableGearItem(inventoryId: string, itemName: string): AvailableGearItem {
  return {
    brand: 'MSR',
    category: 'Stoves',
    inventoryId,
    itemName
  }
}

function createInventoryEntryMutation(
  inventoryId: string,
  itemName: string,
  entryId: string
): PackingListEntryMutationResponse {
  return {
    entry: {
      createdAt: '2026-04-03T09:03:00.000Z',
      customName: null,
      id: entryId,

      inventory: {
        brand: 'MSR',
        category: 'Stoves',
        inventoryId,
        itemName
      },

      isPacked: false,
      source: 'inventory',
      updatedAt: '2026-04-03T09:03:00.000Z'
    },
    packingListUpdatedAt: '2026-04-03T09:03:00.000Z'
  }
}

function createCustomEntryMutation(customName: string): PackingListEntryMutationResponse {
  return {
    entry: {
      createdAt: '2026-04-03T09:04:00.000Z',
      customName,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e4',
      isPacked: false,
      source: 'custom',
      updatedAt: '2026-04-03T09:04:00.000Z'
    },
    packingListUpdatedAt: '2026-04-03T09:04:00.000Z'
  }
}

function createAvailableGearKey(search: string, page: number): string {
  return `${search}:${page}`
}

function createPackingListRouteState(rows: PackingListSummary[]): PackingListRouteState {
  const [firstRow = createPackingListSummary('Alpine weekend')] = rows
  const detailName = firstRow.name

  return {
    availableGearRequests: [],
    availableGearResponses: new Map(),
    createRequests: 0,
    detail: createPackingListDetail(detailName),
    detailRequests: 0,
    entryCreateBodies: [],
    entryCreateResponses: [],
    entryDeleteRequests: 0,
    getDelayMs: 0,
    getRequests: 0,
    rows
  }
}

function isPackingListCreateResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isPackingListCollectionResponse = responseUrl.pathname === '/api/user/packing-lists'
  const isPostRequest = response.request().method() === 'POST'

  return isPackingListCollectionResponse && isPostRequest
}

function isPackingListEntryCreateRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())
  const isEntryCollectionRequest = requestUrl.pathname.endsWith('/entries')
  const isPostRequest = request.method() === 'POST'

  return isEntryCollectionRequest && isPostRequest
}

function isPackingListEntryDeleteResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isEntryDeletePath = responseUrl.pathname.includes(`/api/user/packing-lists/${packingListId}/entries/`)
  const isDeleteRequest = response.request().method() === 'DELETE'

  return isEntryDeletePath && isDeleteRequest
}

async function fulfillPackingListCollectionRoute(route: Route, page: Page, state: PackingListRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'GET') {
    state.getRequests += 1

    if (state.getDelayMs > 0) {
      await page.waitForTimeout(state.getDelayMs)
    }

    await route.fulfill({
      json: state.rows
    })

    return
  }

  if (method === 'POST') {
    state.createRequests += 1

    expect(request.postDataJSON()).toStrictEqual({
      name: 'Alpine weekend'
    })

    await page.waitForTimeout(250)

    const createdList = createPackingListSummary('Alpine weekend')

    state.detail = createPackingListDetail(createdList.name)
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

async function fulfillAvailableGearRoute(route: Route, requestUrl: URL, state: PackingListRouteState): Promise<void> {
  const page = Number(requestUrl.searchParams.get('page') ?? '1')
  const search = requestUrl.searchParams.get('search') ?? ''
  const responseKey = createAvailableGearKey(search, page)
  const configuredResponses = state.availableGearResponses.get(responseKey) ?? []
  const response = configuredResponses.length > 1
    ? configuredResponses.shift()
    : configuredResponses[0]

  state.availableGearRequests.push({
    page,
    search
  })

  await route.fulfill({
    json: response ?? {
      items: [],
      nextPage: null
    }
  })
}

async function fulfillEntryCreateRoute(route: Route, state: PackingListRouteState): Promise<void> {
  const body: unknown = route.request().postDataJSON()
  const response = state.entryCreateResponses.shift()

  state.entryCreateBodies.push(body)

  if (response === undefined) {
    await route.fulfill({
      status: 500,

      json: {
        message: 'No entry response configured'
      }
    })

    return
  }

  await route.fulfill({
    status: 201,
    json: response
  })
}

async function fulfillEntryDeleteRoute(route: Route, state: PackingListRouteState): Promise<void> {
  const requestUrl = new globalThis.URL(route.request().url())
  const entryId = requestUrl.pathname.split('/').at(-1) ?? ''
  const entryExists = state.detail.entries.some((entry) => entry.id === entryId)

  state.entryDeleteRequests += 1

  if (entryExists === false) {
    await route.fulfill({
      status: 404,
      json: {
        statusCode: 404
      }
    })

    return
  }

  state.detail = {
    createdAt: state.detail.createdAt,
    entries: state.detail.entries.filter((entry) => entry.id !== entryId),
    id: state.detail.id,
    name: state.detail.name,
    updatedAt: '2026-04-03T09:06:00.000Z'
  }

  await route.fulfill({
    status: 200,
    json: {
      deletedEntryId: entryId,
      packingListUpdatedAt: state.detail.updatedAt
    }
  })
}

async function mockPackingListRoutes(context: BrowserContext, page: Page, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/packing-lists**', async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())
    const requestMethod = route.request().method()
    const detailPath = `/api/user/packing-lists/${packingListId}`

    if (requestUrl.pathname === '/api/user/packing-lists') {
      await fulfillPackingListCollectionRoute(route, page, state)

      return
    }

    if (requestUrl.pathname === `${detailPath}/available-gear` && requestMethod === 'GET') {
      await fulfillAvailableGearRoute(route, requestUrl, state)

      return
    }

    if (requestUrl.pathname === `${detailPath}/entries` && requestMethod === 'POST') {
      await fulfillEntryCreateRoute(route, state)

      return
    }

    if (requestUrl.pathname.startsWith(`${detailPath}/entries/`) && requestMethod === 'DELETE') {
      await fulfillEntryDeleteRoute(route, state)

      return
    }

    if (requestUrl.pathname !== detailPath || requestMethod !== 'GET') {
      await route.abort()

      return
    }

    state.detailRequests += 1
    await route.fulfill({
      json: state.detail
    })
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

test.describe('Packing list shell', () => {
  test('should create a list and stay on the packing lists page', async ({ context, page }) => {
    const state = createPackingListRouteState([])

    await mockAuth(context)
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
    expect(state.createRequests).toBe(1)

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { name: 'Create a packing list' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()
    expect(state.detailRequests).toBe(0)
  })

  test('should route from a list card to the item list page', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])

    state.detail = createPackingListDetail('Alpine weekend', createPackingListEntries())

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByText('Rain jacket')).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('MSR / Stoves')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Rain jacket' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)
  })

  test('should refresh the open item composer after removing an inventory item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Weekend trail')])
    const availablePocketRocket = createAvailableGearItem(pocketRocketInventoryId, 'PocketRocket Deluxe')
    const existingEntry: PackingListInventoryEntry = {
      createdAt: '2026-04-03T09:02:00.000Z',
      customName: null,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

      inventory: {
        brand: 'MSR',
        category: 'Stoves',
        inventoryId: pocketRocketInventoryId,
        itemName: 'PocketRocket Deluxe'
      },

      isPacked: true,
      source: 'inventory',
      updatedAt: '2026-04-03T09:02:00.000Z'
    }
    const firstPageKey = createAvailableGearKey('', 1)

    state.detail = createPackingListDetail('Weekend trail', [existingEntry])
    state.availableGearResponses.set(firstPageKey, [{
      items: [],
      nextPage: null
    }, {
      items: [availablePocketRocket],
      nextPage: null
    }])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Weekend trail/iu }).click()
    await page.getByText('Add item', { exact: true }).click()
    await expect(page.getByText('No available My gear items. Type a name to add a custom item.')).toBeVisible()

    const deleteResponsePromise = page.waitForResponse(isPackingListEntryDeleteResponse)

    await page.getByRole('button', { name: 'Remove PocketRocket Deluxe' }).click()

    const deleteResponse = await deleteResponsePromise
    const deleteResponseUrl = new globalThis.URL(deleteResponse.url())

    expect(deleteResponse.status()).toBe(200)
    expect(deleteResponseUrl.pathname).toBe(`/api/user/packing-lists/${packingListId}/entries/${existingEntry.id}`)
    expect(state.entryDeleteRequests).toBe(1)
    await expect(page.getByRole('button', { name: 'Remove PocketRocket Deluxe' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^PocketRocket Deluxe MSR · Stoves Add$/u })).toBeVisible()
    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }, {
      page: 1,
      search: ''
    }])
  })

  test('should close the item composer with Escape and restore focus', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Keyboard trail')])

    state.detail = createPackingListDetail('Keyboard trail', createPackingListEntries().slice(0, 1))

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Keyboard trail/iu }).click()

    const composerSummary = page.locator('summary').filter({ hasText: 'Add item' })
    const searchInput = page.getByLabel('Find an item')

    await composerSummary.click()
    await expect(searchInput).toBeFocused()
    await searchInput.fill('Rain')
    await searchInput.press('Escape')

    await expect(searchInput).toBeHidden()
    await expect(composerSummary).toBeFocused()
    await expect(page.getByText('Add item', { exact: true })).toBeVisible()
  })

  test('should lazily load My gear, load another page, and add an inventory item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const pocketRocket = createAvailableGearItem(pocketRocketInventoryId, 'PocketRocket Deluxe')
    const whisperLite = createAvailableGearItem(whisperLiteInventoryId, 'WhisperLite Universal')
    const firstPageKey = createAvailableGearKey('', 1)
    const secondPageKey = createAvailableGearKey('', 2)

    state.detail = createPackingListDetail('Alpine weekend', createPackingListEntries().slice(0, 1))
    state.availableGearResponses.set(firstPageKey, [{
      items: [pocketRocket],
      nextPage: 2
    }, {
      items: [],
      nextPage: null
    }])
    state.availableGearResponses.set(secondPageKey, [{
      items: [whisperLite],
      nextPage: null
    }])
    state.entryCreateResponses.push(createInventoryEntryMutation(
      whisperLiteInventoryId,
      'WhisperLite Universal',
      '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3'
    ))

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page.getByText('Add item', { exact: true })).toBeVisible()
    expect(state.availableGearRequests).toHaveLength(0)

    await page.getByText('Add item', { exact: true }).click()
    await expect(page.getByRole('button', { name: /PocketRocket Deluxe/iu })).toBeVisible()
    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }])

    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByRole('button', { name: /WhisperLite Universal/iu })).toBeVisible()

    const createRequestPromise = page.waitForRequest(isPackingListEntryCreateRequest)

    await page.getByRole('button', { name: /WhisperLite Universal/iu }).click()
    await createRequestPromise

    await expect(page.getByText('WhisperLite Universal', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('WhisperLite Universal added.', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Find an item')).toBeFocused()
    expect(state.entryCreateBodies).toStrictEqual([{
      inventoryId: whisperLiteInventoryId
    }])
    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }, {
      page: 2,
      search: ''
    }, {
      page: 1,
      search: ''
    }])
  })

  test('should debounce search and add the query as a custom item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const customName = 'Emergency blanket'
    const emptyPage = {
      items: [],
      nextPage: null
    }

    state.detail = createPackingListDetail('Alpine weekend', createPackingListEntries().slice(0, 1))
    state.availableGearResponses.set(createAvailableGearKey('', 1), [emptyPage])
    state.availableGearResponses.set(createAvailableGearKey(customName, 1), [emptyPage])
    state.entryCreateResponses.push(createCustomEntryMutation(customName))

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await page.getByText('Add item', { exact: true }).click()

    const searchInput = page.getByLabel('Find an item')

    await searchInput.fill('Emergency')
    await searchInput.fill(customName)
    await expect(page.getByRole('button', { name: `Add "${customName}" as custom item` })).toBeVisible()

    const latestAvailableGearRequest = state.availableGearRequests.at(-1)

    expect(latestAvailableGearRequest).toStrictEqual({
      page: 1,
      search: customName
    })

    await page.getByRole('button', { name: `Add "${customName}" as custom item` }).click()

    await expect(page.getByText(customName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`${customName} added.`, { exact: true })).toHaveCount(0)
    await expect(searchInput).toBeFocused()
    await expect(searchInput).toHaveValue('')
    expect(state.entryCreateBodies).toStrictEqual([{
      customName
    }])
  })

  test('should show an empty item list page', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Empty trail')])

    state.detail = createPackingListDetail('Empty trail')

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('link', { name: /Empty trail/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Empty trail' })).toBeVisible()
    await expect(page.getByText('Add another item', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Find an item')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)
    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }])
  })

  test('should show cached lists while refreshing on return', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Cache trail')])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    const sidebar = page.getByTestId('shell-sidebar')

    await expect(page.getByRole('link', { name: /Cache trail/iu })).toBeVisible()
    expect(state.getRequests).toBe(1)

    state.rows = [createPackingListSummary('Server trail')]
    state.getDelayMs = 500

    await sidebar.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/$/u)

    await sidebar.getByRole('link', { name: 'Packing lists' }).click()

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { name: 'Loading packing lists' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Cache trail/iu })).toBeVisible()
    await expect(page.getByRole('link', { name: /Server trail/iu })).toBeVisible()
    expect(state.getRequests).toBe(2)
  })
})
