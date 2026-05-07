import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'
import { URL } from 'node:url'

interface PackingListSummary {
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListRouteState {
  createRequests: number;
  createShouldFail: boolean;
  deleteShouldFail: boolean;
  rows: PackingListSummary[];
}

const packingListId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

function createPackingList(name: string): PackingListSummary {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    id: packingListId,
    name,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
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
      json: createdList
    })

    return
  }

  await route.abort()
}

async function fulfillPackingListDetailRoute(route: Route, page: Page, state: PackingListRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()
  const requestUrlText = request.url()
  const requestUrl = new URL(requestUrlText)
  const packingList = state.rows.find((row) => requestUrl.pathname.endsWith(`/api/user/packing-lists/${row.id}`))

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

    if (state.deleteShouldFail) {
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
    const request = route.request()
    const requestUrlText = request.url()
    const requestUrl = new URL(requestUrlText)

    if (requestUrl.pathname === '/api/user/packing-lists') {
      await fulfillPackingListCollectionRoute(route, page, state)

      return
    }

    await fulfillPackingListDetailRoute(route, page, state)
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
  await page.getByRole('link', { name: 'Packs' }).click()
}

async function openPackingListDetail(page: Page): Promise<void> {
  await page.goto(`/login?redirectTo=/packs/${packingListId}`)
  await page.getByRole('button', { name: 'Guest' }).click()
}

test.describe('Packing list shell', () => {
  test('should create an empty pack from the empty state', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      rows: []
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(page.getByRole('heading', { level: 1, name: 'Packs', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No packs yet.' })).toBeVisible()
    await expect(page.getByTestId('page-content-actions')).toHaveCount(0)

    await page.getByRole('button', { name: 'New pack' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeVisible()
    await page.getByLabel('Pack name').fill('Alpine weekend')

    const createButton = page.getByRole('button', { name: 'Create pack' })
    const createPromise = createButton.click()
    await expect(createButton).toBeDisabled()
    await expect(createButton).toBeVisible()
    await createPromise

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByText('Items', { exact: true })).toBeVisible()
    await expect(page.getByText('Updated', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save name', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  })

  test('should open the create pack dialog from the header action', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await expect(page.getByTestId('page-content-actions')).toBeVisible()
    await page.getByRole('button', { name: 'New pack' }).click()

    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeVisible()
    await expect(page.getByLabel('Pack name')).toBeFocused()
  })

  test('should close the create pack dialog without creating a pack', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      rows: []
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('button', { name: 'New pack' }).first().click()
    await page.getByLabel('Pack name').fill('Alpine weekend')
    await page.getByRole('button', { name: 'Close new pack dialog' }).click()

    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeHidden()

    await page.getByRole('button', { name: 'New pack' }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeHidden()
    expect(state.createRequests).toBe(0)
    expect(state.rows).toHaveLength(0)
  })

  test('should keep the create pack dialog open when creation fails', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: true,
      deleteShouldFail: false,
      rows: []
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await page.getByRole('button', { name: 'New pack' }).first().click()
    await page.getByLabel('Pack name').fill('Alpine weekend')
    await page.getByRole('button', { name: 'Create pack' }).click()

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(page.getByRole('heading', { name: 'Create a pack' })).toBeVisible()
    await expect(page.getByText('We could not create this pack right now.')).toBeVisible()
    await expect(page.getByLabel('Pack name')).toHaveValue('Alpine weekend')
    expect(state.rows).toHaveLength(0)
  })

  test('should open pack detail from a navigational card', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    await expect(page.getByRole('button', { name: /delete/iu })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()

    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Alpine weekend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No items in this pack yet.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete pack' })).toBeVisible()
  })

  test('should keep the pack when delete is canceled', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: false,
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
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
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete pack' }).click()

    const confirmButton = page.getByRole('button', { name: 'Delete pack' }).last()
    await expect(confirmButton).toBeVisible()
    await confirmButton.click()

    await expect(page).toHaveURL(/\/packs$/u)
    await expect(page.getByRole('heading', { name: 'No packs yet.' })).toBeVisible()
    expect(state.rows).toHaveLength(0)
  })

  test('should keep the delete dialog open when deletion fails', async ({ context, page }) => {
    const state: PackingListRouteState = {
      createRequests: 0,
      createShouldFail: false,
      deleteShouldFail: true,
      rows: [createPackingList('Alpine weekend')]
    }

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)

    await openPackingListDetail(page)
    await page.getByRole('button', { name: 'Delete pack' }).click()
    await page.getByRole('button', { name: 'Delete pack' }).last().click()

    await expect(page).toHaveURL(new RegExp(`/packs/${packingListId}$`, 'u'))
    await expect(page.getByRole('heading', { name: 'Delete "Alpine weekend"?' })).toBeVisible()
    await expect(page.getByText('We could not delete this pack right now.')).toBeVisible()
    expect(state.rows).toHaveLength(1)
  })
})
