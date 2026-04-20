import { URL } from 'node:url'
import { expect, test, type BrowserContext } from '@playwright/test'

interface CatalogItemsResponse {
  items: {
    id: string;
    name: string;

    brand: {
      name: string;
      slug: string;
    };

    category: {
      name: string;
      slug: string;
    };
  }[];
  limit: number;
  page: number;
  total: number;
}

const firstPageResponse: CatalogItemsResponse = {
  items: [{
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
    name: 'PocketRocket Deluxe',

    brand: {
      name: 'MSR',
      slug: 'msr'
    },

    category: {
      name: 'Stoves',
      slug: 'stoves'
    }
  }, {
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
    name: 'NeoAir XLite NXT',

    brand: {
      name: 'Therm-a-Rest',
      slug: 'therm-a-rest'
    },

    category: {
      name: 'Sleeping Pads',
      slug: 'sleeping-pads'
    }
  }],
  limit: 2,
  page: 1,
  total: 3
}

const secondPageResponse: CatalogItemsResponse = {
  items: [{
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    name: 'WhisperLite Universal',

    brand: {
      name: 'MSR',
      slug: 'msr'
    },

    category: {
      name: 'Stoves',
      slug: 'stoves'
    }
  }],
  limit: 2,
  page: 2,
  total: 3
}

const outOfRangePageResponse: CatalogItemsResponse = {
  items: [],
  limit: 2,
  page: 999,
  total: 3
}

async function mockGuestLogin(context: BrowserContext) {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      }
    })
  })
}

async function trackCategoryRequests(context: BrowserContext) {
  const requestCounter = {
    count: 0
  }

  await context.route('**/api/equipment/categories**', async (route) => {
    requestCounter.count += 1

    await route.fulfill({
      status: 500,
      json: {
        statusCode: 500
      }
    })
  })

  return requestCounter
}

test.describe('Catalog page', () => {
  test('should restore the catalog route after guest login and render all items', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: firstPageResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/catalog$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByRole('heading', { name: 'Catalog', exact: true })).toBeVisible()
    await expect(page.getByText('3 items')).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'NeoAir XLite NXT' })).toBeVisible()
    await expect(page.getByText('MSR').first()).toBeVisible()
    await expect(page.getByText('Therm-a-Rest')).toBeVisible()
    await expect(page.getByText('Stoves').first()).toBeVisible()
    await expect(page.getByText('Sleeping Pads')).toBeVisible()
    expect(categoryRequests.count).toBe(0)
  })

  test('should keep only the page query in the url while paginating', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      const requestUrl = new URL(route.request().url())
      const pageParam = requestUrl.searchParams.get('page')

      if (pageParam === '2') {
        await route.fulfill({
          json: secondPageResponse
        })

        return
      }

      await route.fulfill({
        json: firstPageResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog?page=2')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/catalog\?page=2$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog\?page=2$/u)
    await expect(page.getByText('WhisperLite Universal')).toBeVisible()
    await expect(page.getByText('MSR').first()).toBeVisible()
    await expect(page.getByText('Stoves').first()).toBeVisible()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()

    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('Page 1 of 2')).toBeVisible()
    expect(categoryRequests.count).toBe(0)
  })

  test('should show a loading state while items are pending', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      const requestUrl = new URL(route.request().url())
      const pageParam = requestUrl.searchParams.get('page')

      if (pageParam === '2') {
        await page.waitForTimeout(500)

        await route.fulfill({
          json: secondPageResponse
        })

        return
      }

      await route.fulfill({
        json: firstPageResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('status', { name: 'Loading page' })).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await expect(page).toHaveURL(/\/catalog\?page=2$/u)
    await expect(page.getByText('WhisperLite Universal')).toBeVisible()
    await expect(page.getByText('3 items')).toBeVisible()
    expect(categoryRequests.count).toBe(0)
  })

  test('should show a generic empty state when there are no items', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: {
          items: [],
          limit: 20,
          page: 1,
          total: 0
        } satisfies CatalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/catalog$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByText('0 items')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No items yet.' })).toBeVisible()
    await expect(page.getByText('We do not have any items to show here yet.')).toBeVisible()
    expect(categoryRequests.count).toBe(0)
  })

  test('should recover from an out-of-range catalog page without showing the empty state', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      const requestUrl = new URL(route.request().url())
      const pageParam = requestUrl.searchParams.get('page')

      if (pageParam === '999') {
        await route.fulfill({
          json: outOfRangePageResponse
        })

        return
      }

      if (pageParam === '2') {
        await route.fulfill({
          json: secondPageResponse
        })

        return
      }

      await route.fulfill({
        json: firstPageResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog?page=999')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog\?page=999$/u)
    await expect(page.getByText('3 items')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'This page is out of range.' })).toBeVisible()
    await expect(page.getByText('There are catalog items here, but this page number is no longer valid.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No items yet.' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Go to last page' }).click()

    await expect(page).toHaveURL(/\/catalog\?page=2$/u)
    await expect(page.getByText('WhisperLite Universal')).toBeVisible()

    expect(categoryRequests.count).toBe(0)
  })

  test('should show a unified error state when catalog data fails to load', async ({ context, page }) => {
    await mockGuestLogin(context)

    const categoryRequests = await trackCategoryRequests(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          statusCode: 500
        }
      })
    })

    await page.goto('/login?redirectTo=/catalog')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/catalog$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByRole('heading', { name: 'Catalog is temporarily unavailable.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    expect(categoryRequests.count).toBe(0)
  })
})
