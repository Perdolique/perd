import type { BrowserContext, Page, Response, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

interface GearLibraryEntitySummary {
  name: string;
  slug: string;
}

interface GearLibraryEntityDetail extends GearLibraryEntitySummary {
  id: number;
}

interface GearLibraryListItem {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  id: string;
  name: string;
  properties: EquipmentProperty[];
}

interface GearLibraryItemsResponse {
  items: GearLibraryListItem[];
  limit: number;
  page: number;
  total: number;
}

type EquipmentPropertyDataType = 'boolean' | 'enum' | 'number' | 'text'

interface EquipmentProperty {
  dataType: EquipmentPropertyDataType;
  name: string;
  slug: string;
  unit: string | null;
  value: string | number | boolean | null;
}

interface ItemDetailResponse {
  brand: GearLibraryEntityDetail;
  category: GearLibraryEntityDetail;
  createdAt: string;
  id: string;
  name: string;
  properties: EquipmentProperty[];
}

interface MyGearItem {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  id: string;
  name: string;
}

interface MyGearRecord {
  createdAt: string;
  id: string;
  item: MyGearItem;
}

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const myGearId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'

const gearLibraryItemsResponse: GearLibraryItemsResponse = {
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
    },

    properties: [{
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g',
      value: 83
    }, {
      dataType: 'boolean',
      name: 'Piezo',
      slug: 'piezo',
      unit: null,
      value: true
    }]
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
    value: 83
  }, {
    dataType: 'boolean',
    name: 'Piezo',
    slug: 'piezo',
    unit: null,
    value: true
  }],

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

interface MyGearRouteState {
  getRequestCount: number;
  rows: MyGearRecord[];
}

function createMyGearRow(): MyGearRecord {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    id: myGearId,

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

function isMyGearCreateResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isMyGearCollectionResponse = responseUrl.pathname === '/api/user/gear'
  const isPostRequest = response.request().method() === 'POST'

  return isMyGearCollectionResponse && isPostRequest
}

function isMyGearDeleteResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isMyGearItemResponse = responseUrl.pathname === `/api/user/gear/${myGearId}`
  const isDeleteRequest = response.request().method() === 'DELETE'

  return isMyGearItemResponse && isDeleteRequest
}

async function fulfillMyGearCollectionRoute(route: Route, page: Page, myGearState: MyGearRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'GET') {
    myGearState.getRequestCount += 1

    await route.fulfill({
      json: myGearState.rows
    })

    return
  }

  if (method === 'POST') {
    expect(request.postDataJSON()).toStrictEqual({
      itemId
    })

    await page.waitForTimeout(250)

    const createdMyGearRow = createMyGearRow()
    myGearState.rows = [createdMyGearRow]

    await route.fulfill({
      status: 201,
      json: createdMyGearRow
    })

    return
  }

  await route.abort()
}

async function fulfillMyGearItemRoute(route: Route, page: Page, myGearState: MyGearRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'DELETE') {
    expect(request.url()).toContain(`/api/user/gear/${myGearId}`)

    await page.waitForTimeout(250)
    myGearState.rows = []

    await route.fulfill({
      status: 204,
      body: ''
    })

    return
  }

  await route.abort()
}

async function mockMyGearRoutes(context: BrowserContext, page: Page, myGearState: MyGearRouteState): Promise<void> {
  await context.route('**/api/user/gear', async (route) => {
    await fulfillMyGearCollectionRoute(route, page, myGearState)
  })

  await context.route('**/api/user/gear/*', async (route) => {
    await fulfillMyGearItemRoute(route, page, myGearState)
  })
}

test.describe('Gear library my gear flow', () => {
  test('should add and remove an item through detail and my gear pages', async ({ context, page }) => {
    const myGearState: MyGearRouteState = {
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
        json: gearLibraryItemsResponse
      })
    })

    await context.route('**/api/equipment/categories**', async (route) => {
      await route.fulfill({
        json: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }]
      })
    })

    await context.route('**/api/equipment/items/*', async (route) => {
      await route.fulfill({
        json: itemDetailResponse
      })
    })

    await mockMyGearRoutes(context, page, myGearState)
    await page.goto('/login?redirectTo=/gear-library')
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(/\/gear-library$/u)
    await page.getByRole('link', { name: 'PocketRocket Deluxe' }).click()
    await expect(page).toHaveURL(new RegExp(`/gear-library/${itemId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByText('83 g')).toBeVisible()
    await expect(page.getByText('Yes', { exact: true })).toBeVisible()
    const addButton = page.getByRole('button', { name: 'Save to my gear' })
    await expect(addButton).toBeVisible()
    await expect(page.getByRole('link', { name: 'View my gear' })).toBeVisible()
    await expect(page.getByText('Checking my gear', { exact: true })).toHaveCount(0)

    const addResponsePromise = page.waitForResponse(isMyGearCreateResponse)

    await addButton.click()

    const addResponse = await addResponsePromise

    expect(addResponse.status()).toBe(201)
    expect(myGearState.getRequestCount).toBe(1)

    const removeFromDetailButton = page.getByRole('button', { name: 'Remove from my gear' })

    await expect(removeFromDetailButton).toBeVisible()
    await page.getByRole('link', { name: 'View my gear' }).click()

    await expect(page).toHaveURL(/\/my-gear$/u)
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    expect(myGearState.getRequestCount).toBe(2)

    const removeFromMyGearButton = page.getByRole('button', { name: 'Remove' })
    const removeResponsePromise = page.waitForResponse(isMyGearDeleteResponse)

    await removeFromMyGearButton.click()

    const removeResponse = await removeResponsePromise

    expect(removeResponse.status()).toBe(204)
    expect(myGearState.getRequestCount).toBe(2)

    await expect(page.getByRole('heading', { name: 'No saved gear yet.' })).toBeVisible()
    await page.getByRole('link', { name: 'Find gear' }).click()
    await page.getByRole('link', { name: 'PocketRocket Deluxe' }).click()
    await expect(page.getByRole('button', { name: 'Save to my gear' })).toBeVisible()
  })
})
