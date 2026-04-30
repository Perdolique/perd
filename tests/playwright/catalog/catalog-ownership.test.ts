import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface CatalogEntityDetail extends CatalogEntitySummary {
  id: number;
}

interface CatalogListItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  id: string;
  name: string;
}

interface CatalogItemsResponse {
  items: CatalogListItem[];
  limit: number;
  page: number;
  total: number;
}

interface ItemDetailProperty {
  dataType: string;
  name: string;
  slug: string;
  unit: string | null;
  value: string | null;
}

interface ItemDetailResponse {
  brand: CatalogEntityDetail;
  category: CatalogEntityDetail;
  createdAt: string;
  id: string;
  name: string;
  properties: ItemDetailProperty[];
  status: string;
}

interface InventoryItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  id: string;
  name: string;
}

interface InventoryRecord {
  createdAt: string;
  id: string;
  item: InventoryItem;
}

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const inventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'

const catalogItemsResponse: CatalogItemsResponse = {
  items: [{
    id: itemId,
    name: 'PocketRocket Deluxe',

    brand: {
      name: 'MSR',
      slug: 'msr'
    },

    category: {
      name: 'Stoves',
      slug: 'stoves'
    }
  }],
  limit: 20,
  page: 1,
  total: 1
}

const itemDetailResponse: ItemDetailResponse = {
  createdAt: '2026-04-01T09:00:00.000Z',
  id: itemId,
  name: 'PocketRocket Deluxe',
  properties: [{
    dataType: 'number',
    name: 'Weight',
    slug: 'weight',
    unit: 'g',
    value: '83'
  }, {
    dataType: 'boolean',
    name: 'Piezo',
    slug: 'piezo',
    unit: null,
    value: 'true'
  }],
  status: 'approved',

  brand: {
    id: 1,
    name: 'MSR',
    slug: 'msr'
  },

  category: {
    id: 2,
    name: 'Stoves',
    slug: 'stoves'
  }
}

interface InventoryRouteState {
  getRequestCount: number;
  rows: InventoryRecord[];
}

function createInventoryRow(): InventoryRecord {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    id: inventoryId,

    item: {
      id: itemId,
      name: 'PocketRocket Deluxe',

      brand: {
        name: 'MSR',
        slug: 'msr'
      },

      category: {
        name: 'Stoves',
        slug: 'stoves'
      }
    }
  }
}

async function fulfillInventoryCollectionRoute(route: Route, page: Page, inventoryState: InventoryRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'GET') {
    inventoryState.getRequestCount += 1

    await route.fulfill({
      json: inventoryState.rows
    })

    return
  }

  if (method === 'POST') {
    expect(request.postDataJSON()).toStrictEqual({
      itemId
    })

    await page.waitForTimeout(250)

    const createdInventoryRow = createInventoryRow()
    inventoryState.rows = [createdInventoryRow]

    await route.fulfill({
      status: 201,
      json: createdInventoryRow
    })

    return
  }

  await route.abort()
}

async function fulfillInventoryItemRoute(route: Route, page: Page, inventoryState: InventoryRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'DELETE') {
    expect(request.url()).toContain(`/api/user/equipment/${inventoryId}`)

    await page.waitForTimeout(250)
    inventoryState.rows = []

    await route.fulfill({
      status: 204,
      body: ''
    })

    return
  }

  await route.abort()
}

async function mockInventoryRoutes(context: BrowserContext, page: Page, inventoryState: InventoryRouteState): Promise<void> {
  await context.route('**/api/user/equipment', async (route) => {
    await fulfillInventoryCollectionRoute(route, page, inventoryState)
  })

  await context.route('**/api/user/equipment/*', async (route) => {
    await fulfillInventoryItemRoute(route, page, inventoryState)
  })
}

test.describe('Catalog ownership flow', () => {
  test('should add and remove an item through detail and inventory pages', async ({ context, page }) => {
    const inventoryState: InventoryRouteState = {
      getRequestCount: 0,
      rows: []
    }

    await context.route('**/api/auth/create-session**', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await context.route('**/api/equipment/items/*', async (route) => {
      await route.fulfill({
        json: itemDetailResponse
      })
    })

    await mockInventoryRoutes(context, page, inventoryState)

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await page.getByRole('link', { name: 'PocketRocket Deluxe' }).click()

    await expect(page).toHaveURL(new RegExp(`/catalog/${itemId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByText('83 g')).toBeVisible()
    const addButton = page.getByRole('button', { name: 'I have this' })
    await expect(addButton).toBeVisible()
    await expect(page.getByRole('link', { name: 'View inventory' })).toBeVisible()
    await expect(page.getByText('Checking ownership...', { exact: true })).toHaveCount(0)

    const addActionPromise = addButton.click()
    await expect(addButton).toBeDisabled()
    await expect(addButton).toBeVisible()
    await addActionPromise

    expect(inventoryState.getRequestCount).toBe(1)

    const removeFromDetailButton = page.getByRole('button', { name: 'Remove from inventory' })
    await expect(removeFromDetailButton).toBeVisible()
    await page.getByRole('link', { name: 'View inventory' }).click()

    await expect(page).toHaveURL(/\/inventory$/u)
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    expect(inventoryState.getRequestCount).toBe(2)

    const removeFromInventoryButton = page.getByRole('button', { name: 'Remove' })
    const removeActionPromise = removeFromInventoryButton.click()
    await expect(removeFromInventoryButton).toBeDisabled()
    await expect(removeFromInventoryButton).toBeVisible()
    await removeActionPromise

    expect(inventoryState.getRequestCount).toBe(2)
    await expect(page.getByRole('heading', { name: 'No saved gear yet.' })).toBeVisible()
    await page.getByRole('link', { name: 'Browse catalog' }).click()
    await page.getByRole('link', { name: 'PocketRocket Deluxe' }).click()
    await expect(page.getByRole('button', { name: 'I have this' })).toBeVisible()
  })
})
