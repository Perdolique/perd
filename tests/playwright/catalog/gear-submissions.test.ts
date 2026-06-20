import { expect, test, type BrowserContext, type Locator, type Page, type Response, type Route } from '@playwright/test'
import { URL } from 'node:url'

interface CatalogEntityDetail {
  id: number;
  name: string;
  slug: string;
}

interface CategoryPropertyDetail {
  dataType: string;
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface CategoryDetailResponse extends CatalogEntityDetail {
  properties: CategoryPropertyDetail[];
}

interface CatalogEntitySummary {
  name: string;
  slug: string;
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

interface SubmittedItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  createdAt: string;
  id: string;
  name: string;
  properties: {
    dataType: string;
    name: string;
    slug: string;
    unit: string | null;
    value: string;
  }[];
  status: string;
}

interface ItemSubmissionCreateResponse {
  inventory: InventoryRecord;
  item: SubmittedItem;
}

const submittedItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
const submittedInventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'

const brandsResponse: CatalogEntityDetail[] = [{
  id: 1,
  name: 'MSR',
  slug: 'msr'
}]

const categoriesResponse: CatalogEntityDetail[] = [{
  id: 2,
  name: 'Stoves',
  slug: 'stoves'
}]

const categoryDetailResponse: CategoryDetailResponse = {
  id: 2,
  name: 'Stoves',
  slug: 'stoves',

  properties: [{
    dataType: 'number',
    id: 10,
    name: 'Weight',
    slug: 'weight',
    unit: 'g'
  }]
}

const catalogItemsResponse: CatalogItemsResponse = {
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
  }],
  limit: 20,
  page: 1,
  total: 1
}

const submissionResponse: ItemSubmissionCreateResponse = {
  inventory: {
    createdAt: '2026-04-01T00:00:00.000Z',
    id: submittedInventoryId,

    item: {
      id: submittedItemId,
      name: 'Submitted Burner',

      brand: {
        name: 'MSR',
        slug: 'msr'
      },

      category: {
        name: 'Stoves',
        slug: 'stoves'
      }
    }
  },

  item: {
    createdAt: '2026-04-01T00:00:00.000Z',
    id: submittedItemId,
    name: 'Submitted Burner',

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
      value: '83'
    }],

    status: 'pending'
  }
}

async function mockGuestLogin(context: BrowserContext) {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })
}

async function mockSubmissionReferenceRoutes(context: BrowserContext) {
  await context.route('**/api/equipment/brands', async (route) => {
    await route.fulfill({
      json: brandsResponse
    })
  })

  await context.route('**/api/equipment/categories', async (route) => {
    await route.fulfill({
      json: categoriesResponse
    })
  })

  await context.route('**/api/equipment/categories/stoves', async (route) => {
    await route.fulfill({
      json: categoryDetailResponse
    })
  })
}

async function fulfillFullSubmissionRoute(route: Route) {
  const requestBody: unknown = route.request().postDataJSON()

  expect(requestBody).toStrictEqual({
    brandId: 1,
    categoryId: 2,
    name: 'Submitted Burner',

    properties: [{
      propertyId: 10,
      value: '83'
    }]
  })

  await route.fulfill({
    status: 201,
    json: submissionResponse
  })
}

async function mockFullSubmissionCreateRoute(context: BrowserContext) {
  await context.route('**/api/equipment/item-submissions', async (route) => {
    await fulfillFullSubmissionRoute(route)
  })
}

async function mockQuickSubmissionCreateRoute(context: BrowserContext) {
  await context.route('**/api/equipment/item-submissions', async (route) => {
    const requestBody: unknown = route.request().postDataJSON()

    expect(requestBody).toStrictEqual({
      brandId: 1,
      categoryId: 2,
      name: 'Submitted Burner',
      properties: []
    })

    await route.fulfill({
      status: 201,
      json: submissionResponse
    })
  })
}

function isSubmissionCreateResponse(response: Response): boolean {
  const responseUrl = new URL(response.url())
  const isSubmissionResponse = responseUrl.pathname === '/api/equipment/item-submissions'
  const isPostRequest = response.request().method() === 'POST'

  return isSubmissionResponse && isPostRequest
}

async function submitQuickGear(page: Page) {
  await page.getByRole('button', { name: 'Add gear' }).click()
  await page.getByLabel('Item name').fill('Submitted Burner')
  await page.getByLabel('Brand').selectOption({ label: 'MSR' })
  await page.getByLabel('Category').selectOption({ label: 'Stoves' })

  const responsePromise = page.waitForResponse(isSubmissionCreateResponse)

  await page.getByRole('button', { name: 'Create now' }).click()

  const response = await responsePromise

  expect(response.status()).toBe(201)
}

async function expectPristineControl(control: Locator) {
  await expect(control).toHaveValue('')

  await expect.poll(async () => control.evaluate((element) => element.matches(':user-invalid'))).toBe(false)
}

test.describe('Gear submissions', () => {
  test('should keep the submission dialog open after a backdrop click', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()
    await page.getByRole('button', { name: 'Add gear' }).click()

    await page.getByLabel('Item name').fill('Submitted Burner')
    await page.mouse.click(10, 10)

    await expect(page.getByRole('heading', { name: 'Add gear' })).toBeVisible()
    await expect(page.getByLabel('Item name')).toHaveValue('Submitted Burner')
  })

  test('should submit gear from the catalog without adding it to approved results', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)
    await mockQuickSubmissionCreateRoute(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByText('1 item')).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    await submitQuickGear(page)

    await expect(page.getByRole('link', { name: 'Submitted Burner' })).toBeVisible()
    await expect(page.getByText('1 item')).toBeVisible()
  })

  test('should open the full submission page from the dialog with base fields preserved', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()
    await page.getByRole('button', { name: 'Add gear' }).click()

    await page.getByLabel('Item name').fill('Submitted Burner')
    await page.getByLabel('Brand').selectOption({ label: 'MSR' })
    await page.getByLabel('Category').selectOption({ label: 'Stoves' })
    await page.getByRole('link', { name: 'Add details on full page' }).click()

    await expect(page).toHaveURL(/\/gear\/new\?name=Submitted\+Burner&brandId=1&categoryId=2$/u)
    await expect(page.getByLabel('Item name')).toHaveValue('Submitted Burner')
    await expect(page.getByLabel('Brand')).toHaveValue('1')
    await expect(page.getByLabel('Category')).toHaveValue('2')
    await expect(page.getByLabel('Weight')).toBeVisible()
  })

  test('should reopen the submission dialog with pristine required selects', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()
    await page.getByRole('button', { name: 'Add gear' }).click()

    await page.getByLabel('Brand').selectOption({ label: 'MSR' })
    await page.getByLabel('Category').selectOption({ label: 'Stoves' })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Add gear' }).click()

    await expectPristineControl(page.getByLabel('Brand'))
    await expectPristineControl(page.getByLabel('Category'))
  })

  test('should submit quick gear without loading optional category details', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockQuickSubmissionCreateRoute(context)

    await context.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: brandsResponse
      })
    })

    await context.route('**/api/equipment/categories', async (route) => {
      await route.fulfill({
        json: categoriesResponse
      })
    })

    await context.route('**/api/equipment/categories/stoves', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          message: 'Category details failed'
        }
      })
    })

    await context.route('**/api/equipment/items**', async (route) => {
      await route.fulfill({
        json: catalogItemsResponse
      })
    })

    await page.goto('/login?redirectTo=/catalog')
    await page.getByRole('button', { name: 'Guest' }).click()
    await page.getByRole('button', { name: 'Add gear' }).click()

    await page.getByLabel('Item name').fill('Submitted Burner')
    await page.getByLabel('Brand').selectOption({ label: 'MSR' })
    await page.getByLabel('Category').selectOption({ label: 'Stoves' })

    const responsePromise = page.waitForResponse(isSubmissionCreateResponse)

    await page.getByRole('button', { name: 'Create now' }).click()

    const response = await responsePromise

    expect(response.status()).toBe(201)
    await expect(page.getByRole('link', { name: 'Submitted Burner' })).toBeVisible()
  })

  test('should submit gear from an empty inventory and prepend the new row', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)
    await mockQuickSubmissionCreateRoute(context)

    await context.route('**/api/user/equipment', async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.goto('/login?redirectTo=/inventory')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/inventory$/u)
    await expect(page.getByRole('heading', { name: 'No saved gear yet.' })).toBeVisible()

    await submitQuickGear(page)

    await expect(page.getByText('Submitted Submitted Burner for review.')).toBeVisible()
    await expect(page.getByText('1 saved item')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Submitted Burner' })).toBeVisible()
    await expect(page.getByText('MSR').first()).toBeVisible()
    await expect(page.getByText('Stoves').first()).toBeVisible()
  })

  test('should submit gear from the full page with optional details', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockSubmissionReferenceRoutes(context)
    await mockFullSubmissionCreateRoute(context)

    await page.goto('/login?redirectTo=/gear/new')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/gear\/new$/u)

    await page.getByLabel('Item name').fill('Submitted Burner')
    await page.getByLabel('Brand').selectOption({ label: 'MSR' })
    await page.getByLabel('Category').selectOption({ label: 'Stoves' })
    await page.getByLabel('Weight').fill('83')

    const responsePromise = page.waitForResponse(isSubmissionCreateResponse)

    await page.getByRole('button', { name: 'Submit item' }).click()

    const response = await responsePromise

    expect(response.status()).toBe(201)
    await expect(page.getByRole('link', { name: 'Submitted Burner' })).toBeVisible()
    await expect(page.getByText('It is in your inventory now.')).toBeVisible()
  })

  test('should submit gear from the full page when optional category details fail to load', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockQuickSubmissionCreateRoute(context)

    await context.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: brandsResponse
      })
    })

    await context.route('**/api/equipment/categories', async (route) => {
      await route.fulfill({
        json: categoriesResponse
      })
    })

    await context.route('**/api/equipment/categories/stoves', async (route) => {
      await route.fulfill({
        status: 500,

        json: {
          message: 'Category details failed'
        }
      })
    })

    await page.goto('/login?redirectTo=/gear/new')
    await page.getByRole('button', { name: 'Guest' }).click()

    await page.getByLabel('Item name').fill('Submitted Burner')
    await page.getByLabel('Brand').selectOption({ label: 'MSR' })
    await page.getByLabel('Category').selectOption({ label: 'Stoves' })

    await expect(page.getByText('Optional category details are unavailable.')).toBeVisible()

    const responsePromise = page.waitForResponse(isSubmissionCreateResponse)

    await page.getByRole('button', { name: 'Submit item' }).click()

    const response = await responsePromise

    expect(response.status()).toBe(201)
    await expect(page.getByRole('link', { name: 'Submitted Burner' })).toBeVisible()
  })
})
