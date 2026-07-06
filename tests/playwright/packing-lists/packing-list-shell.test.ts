import { expect, test, type BrowserContext, type Page, type Response, type Route } from '@playwright/test'
import { URL } from 'node:url'

interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListRouteState {
  createRequests: number;
  detailRequests: number;
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

test.describe('Packing list shell', () => {
  test('should create a list and route to the blank detail page', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      detailRequests: 0,
      rows: []
    }

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

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(0)
  })

  test('should route from a list card to the blank detail page', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      detailRequests: 0,
      rows: [createPackingListSummary('Alpine weekend')]
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(0)
  })
})
