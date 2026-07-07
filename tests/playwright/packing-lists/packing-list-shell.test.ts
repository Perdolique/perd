import { expect, test, type BrowserContext, type Page, type Response, type Route } from '@playwright/test'
import { URL } from 'node:url'

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

interface PackingListRouteState {
  createRequests: number;
  detail: PackingListDetail;
  detailRequests: number;
  getDelayMs: number;
  getRequests: number;
  rows: PackingListSummary[];
}

const packingListId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

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
      inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
      itemName: 'PocketRocket Deluxe'
    },

    isPacked: true,
    source: 'inventory',
    updatedAt: '2026-04-03T09:02:00.000Z'
  }]
}

function createPackingListRouteState(rows: PackingListSummary[]): PackingListRouteState {
  const [firstRow = createPackingListSummary('Alpine weekend')] = rows
  const detailName = firstRow.name

  return {
    createRequests: 0,
    detail: createPackingListDetail(detailName),
    detailRequests: 0,
    getDelayMs: 0,
    getRequests: 0,
    rows
  }
}

function isPackingListCreateResponse(response: Response): boolean {
  const responseUrl = new URL(response.url())
  const isPackingListCollectionResponse = responseUrl.pathname === '/api/user/packing-lists'
  const isPostRequest = response.request().method() === 'POST'

  return isPackingListCollectionResponse && isPostRequest
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

async function mockPackingListRoutes(context: BrowserContext, page: Page, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/packing-lists**', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (requestUrl.pathname === '/api/user/packing-lists') {
      await fulfillPackingListCollectionRoute(route, page, state)

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
    await expect(page.getByText('Unpacked', { exact: true })).toBeVisible()
    await expect(page.getByText('Packed', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)
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
    await expect(page.getByRole('heading', { name: 'No items yet.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)
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
