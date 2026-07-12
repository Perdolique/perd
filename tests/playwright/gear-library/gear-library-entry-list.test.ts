import type { BrowserContext, Locator, Page, Request, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

interface GearLibraryEntitySummary {
  name: string;
  slug: string;
}

interface GearLibraryCategorySummary extends GearLibraryEntitySummary {
  id: number;
}

type EquipmentPropertyDataType = 'boolean' | 'enum' | 'number' | 'text'

interface EquipmentProperty {
  dataType: EquipmentPropertyDataType;
  name: string;
  slug: string;
  unit: string | null;
  value: string | number | boolean | null;
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

interface CategoryDetailProperty {
  dataType: EquipmentPropertyDataType;
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface GearLibraryCategoryDetail extends GearLibraryCategorySummary {
  properties: CategoryDetailProperty[];
}

interface ApiMockResponse {
  json: object;
  status?: number;
  waitFor?: Promise<void>;
}

type ParsedUrl = InstanceType<typeof globalThis.URL>

interface CatalogRequest {
  count: number;
  url: ParsedUrl;
}

type CatalogResponder = (request: CatalogRequest) => ApiMockResponse | Promise<ApiMockResponse>

interface CatalogMockConfig {
  categories?: CatalogResponder;
  categoryDetail?: CatalogResponder;
  items?: CatalogResponder;
}

interface CatalogRequestTracker {
  categories: ParsedUrl[];
  categoryDetails: ParsedUrl[];
  items: ParsedUrl[];
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

interface MutableResponseState {
  response: ApiMockResponse;
}

type QueryEntry = readonly [key: string, value: string]

const stoveItem: GearLibraryListItem = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
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
    dataType: 'enum',
    name: 'Fuel type',
    slug: 'fuel-type',
    unit: null,
    value: 'Canister'
  }, {
    dataType: 'boolean',
    name: 'Piezo ignition',
    slug: 'piezo-ignition',
    unit: null,
    value: true
  }]
}

const sleepingPadItem: GearLibraryListItem = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
  name: 'NeoAir XLite NXT',

  brand: {
    name: 'Therm-a-Rest',
    slug: 'therm-a-rest'
  },

  category: {
    name: 'Sleeping Pads',
    slug: 'sleeping-pads'
  },

  properties: [{
    dataType: 'number',
    name: 'R-value',
    slug: 'r-value',
    unit: null,
    value: 4.5
  }, {
    dataType: 'text',
    name: 'Insulation',
    slug: 'insulation',
    unit: null,
    value: 'ThermaCapture'
  }, {
    dataType: 'text',
    name: 'Pump sack',
    slug: 'pump-sack',
    unit: null,
    value: null
  }]
}

const secondPageItem: GearLibraryListItem = {
  ...stoveItem,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
  name: 'WhisperLite Universal'
}

const firstPageResponse: GearLibraryItemsResponse = {
  items: [stoveItem, sleepingPadItem],
  limit: 2,
  page: 1,
  total: 3
}

const secondPageResponse: GearLibraryItemsResponse = {
  items: [secondPageItem],
  limit: 2,
  page: 2,
  total: 3
}

const refreshedSearchResponse: GearLibraryItemsResponse = {
  items: [secondPageItem],
  limit: 20,
  page: 1,
  total: 1
}

const sleepingPadsResponse: GearLibraryItemsResponse = {
  items: [sleepingPadItem],
  limit: 20,
  page: 1,
  total: 1
}

const emptyResponse: GearLibraryItemsResponse = {
  items: [],
  limit: 20,
  page: 1,
  total: 0
}

const categoriesResponse: GearLibraryCategorySummary[] = [{
  id: 2,
  name: 'Stoves',
  slug: 'stoves'
}, {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads'
}]

const stovesCategoryResponse: GearLibraryCategoryDetail = {
  id: 2,
  name: 'Stoves',
  slug: 'stoves',

  properties: [{
    dataType: 'number',
    id: 21,
    name: 'Weight',
    slug: 'weight',
    unit: 'g'
  }, {
    dataType: 'boolean',
    id: 22,
    name: 'Piezo ignition',
    slug: 'piezo-ignition',
    unit: null
  }]
}

const sleepingPadsCategoryResponse: GearLibraryCategoryDetail = {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads',

  properties: [{
    dataType: 'number',
    id: 11,
    name: 'R-value',
    slug: 'r-value',
    unit: null
  }]
}

const serverErrorResponse: ApiMockResponse = {
  status: 500,

  json: {
    statusCode: 500
  }
}

function respondWithPagination(request: CatalogRequest): ApiMockResponse {
  const requestedPage = request.url.searchParams.get('page')
  const response = requestedPage === '2' ? secondPageResponse : firstPageResponse

  return { json: response }
}

function respondWithEmptyItems(): ApiMockResponse {
  return { json: emptyResponse }
}

function respondFromState(state: MutableResponseState): CatalogResponder {
  return () => state.response
}

function throwUnresolvedDeferred(): never {
  throw new Error('Deferred resolver was not initialized')
}

function createDeferred(): Deferred {
  let resolveDeferred: () => void = throwUnresolvedDeferred

  // oxlint-disable-next-line promise/avoid-new -- The test needs a manually released network response.
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve: resolveDeferred
  }
}

function createStaleCategoryRequestConfig(
  itemsGate: Deferred,
  categoryDetailGate: Deferred
): CatalogMockConfig {
  return {
    categoryDetail: (request) => {
      if (request.url.pathname.endsWith('/stoves')) {
        return {
          json: stovesCategoryResponse,
          waitFor: categoryDetailGate.promise
        }
      }

      return { json: sleepingPadsCategoryResponse }
    },

    items: (request) => {
      const categorySlug = request.url.searchParams.get('categorySlug')

      if (categorySlug === 'stoves') {
        return {
          json: firstPageResponse,
          waitFor: itemsGate.promise
        }
      }

      if (categorySlug === 'sleeping-pads') {
        return { json: sleepingPadsResponse }
      }

      return { json: firstPageResponse }
    }
  }
}

function buildRouteSearch(entries: QueryEntry[]): string {
  const searchParams = new globalThis.URLSearchParams()

  for (const [key, value] of entries) {
    searchParams.append(key, value)
  }

  return `?${searchParams.toString()}`
}

async function fulfillMockResponse(route: Route, response: ApiMockResponse): Promise<void> {
  if (response.waitFor !== undefined) {
    await response.waitFor
  }

  const requestFailure = route.request().failure()

  if (requestFailure === null) {
    await route.fulfill({
      status: response.status ?? 200,
      json: response.json
    })
  }
}

async function resolveMockResponse(
  responder: CatalogResponder | undefined,
  request: CatalogRequest,
  fallback: ApiMockResponse
): Promise<ApiMockResponse> {
  if (responder === undefined) {
    return fallback
  }

  return responder(request)
}

async function mockCatalogApi(context: BrowserContext, config: CatalogMockConfig = {}): Promise<CatalogRequestTracker> {
  const tracker: CatalogRequestTracker = {
    categories: [],
    categoryDetails: [],
    items: []
  }

  await context.route((url) => url.pathname === '/api/equipment/categories', async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())

    tracker.categories.push(requestUrl)

    const request = {
      count: tracker.categories.length,
      url: requestUrl
    }

    const fallback = { json: categoriesResponse }
    const response = await resolveMockResponse(config.categories, request, fallback)

    await fulfillMockResponse(route, response)
  })

  await context.route((url) => /^\/api\/equipment\/categories\/by-slug\/[^/]+$/u.test(url.pathname), async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())

    tracker.categoryDetails.push(requestUrl)

    const request = {
      count: tracker.categoryDetails.length,
      url: requestUrl
    }

    const fallback = { json: stovesCategoryResponse }
    const response = await resolveMockResponse(config.categoryDetail, request, fallback)

    await fulfillMockResponse(route, response)
  })

  await context.route((url) => url.pathname === '/api/equipment/items', async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())

    tracker.items.push(requestUrl)

    const request = {
      count: tracker.items.length,
      url: requestUrl
    }

    const fallback = { json: firstPageResponse }
    const response = await resolveMockResponse(config.items, request, fallback)

    await fulfillMockResponse(route, response)
  })

  return tracker
}

async function mockGuestLogin(context: BrowserContext): Promise<void> {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })
}

async function openGearLibrary(page: Page, path = '/gear-library'): Promise<void> {
  const redirectTo = encodeURIComponent(path)

  await page.goto(`/login?redirectTo=${redirectTo}`)
  await page.getByRole('button', { name: 'Guest' }).click()

  await expect.poll(() => {
    const currentUrl = new globalThis.URL(page.url())

    return currentUrl.pathname
  }).toBe('/gear-library')
}

async function expectRouteSearch(page: Page, expectedSearch: string): Promise<void> {
  const expectedSearchParams = new globalThis.URLSearchParams(expectedSearch)
  const expectedNormalizedSearch = expectedSearchParams.toString()

  await expect.poll(() => {
    const currentUrl = new globalThis.URL(page.url())

    return currentUrl.searchParams.toString()
  }).toBe(expectedNormalizedSearch)
}

function getLastRequest(requests: ParsedUrl[]): ParsedUrl {
  const request = requests.at(-1)

  if (request === undefined) {
    throw new Error('Expected a catalog request')
  }

  return request
}

function isStovesItemsRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/equipment/items'
    && requestUrl.searchParams.get('categorySlug') === 'stoves'
}

function isStovesCategoryDetailRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/equipment/categories/by-slug/stoves'
}

async function waitForNextItemsRequest(tracker: CatalogRequestTracker, previousCount: number): Promise<ParsedUrl> {
  await expect.poll(() => tracker.items.length).toBeGreaterThan(previousCount)

  return getLastRequest(tracker.items)
}

function expectQueryValues(requestUrl: ParsedUrl, expectedValues: Record<string, string | string[]>): void {
  for (const [key, expectedValue] of Object.entries(expectedValues)) {
    if (Array.isArray(expectedValue)) {
      expect(requestUrl.searchParams.getAll(key)).toStrictEqual(expectedValue)
    } else {
      expect(requestUrl.searchParams.get(key)).toBe(expectedValue)
    }
  }
}

async function getElementBox(locator: Locator) {
  const box = await locator.boundingBox()

  if (box === null) {
    throw new Error('Expected the element to have a bounding box')
  }

  return box
}

test.describe('Gear library page', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should render the search-first field guide with enriched rows on desktop', async ({ context, page }) => {
    await page.setViewportSize({
      width: 1280,
      height: 800
    })

    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const categorySelect = searchRegion.getByLabel('Category')
    const sortSelect = searchRegion.getByLabel('Sort by')
    const directionSelect = searchRegion.getByLabel('Direction')

    await expect(page.getByRole('heading', { name: 'Gear library', exact: true })).toBeVisible()
    await expect(searchRegion.getByLabel('Search gear')).toHaveAttribute('type', 'search')
    await expect(categorySelect).toHaveValue('')
    await expect(sortSelect).toHaveValue('name')
    await expect(directionSelect).toHaveValue('asc')

    await expect(categorySelect.locator('option')).toHaveText([
      'All categories',
      'Sleeping Pads',
      'Stoves'
    ])

    await expect(page.getByText('3 items')).toBeVisible()

    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })
    const itemRow = page.getByRole('listitem').filter({ has: detailLink })

    await expect(itemRow).toBeVisible()
    await expect(itemRow.getByRole('link')).toHaveCount(1)
    await expect(itemRow.getByText('MSR', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('Weight', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('83 g', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('Fuel type', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('Canister', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('Piezo ignition', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('Yes', { exact: true })).toBeVisible()

    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const itemsRequest = getLastRequest(tracker.items)

    expectQueryValues(itemsRequest, {
      direction: 'asc',
      page: '1',
      sort: 'name'
    })

    expect(itemsRequest.searchParams.get('search')).toBe('')
    expect(itemsRequest.searchParams.get('categorySlug')).toBeNull()
    expect(tracker.categories).toHaveLength(1)
  })

  test('should canonicalize supported state and keep the mobile keyboard order usable', async ({ context, page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    })

    const tracker = await mockCatalogApi(context)
    const route = '/gear-library?direction=sideways&sort=property%3Aweight&brand=zeta&brand=alpha&brand=alpha&q=%20stove%20&category=stoves&number=b&number=a&enum=z&boolean=b&boolean=a&batch=0&compare=second&compare=first&page=999&debug=1'

    await openGearLibrary(page, route)

    const expectedSearch = buildRouteSearch([
      ['q', 'stove'],
      ['category', 'stoves'],
      ['brand', 'alpha'],
      ['brand', 'zeta'],
      ['number', 'a'],
      ['number', 'b'],
      ['enum', 'z'],
      ['boolean', 'a'],
      ['boolean', 'b'],
      ['sort', 'property:weight'],
      ['compare', 'second'],
      ['compare', 'first']
    ])

    await expectRouteSearch(page, expectedSearch)
    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const itemsRequest = getLastRequest(tracker.items)

    expectQueryValues(itemsRequest, {
      booleanFilter: ['a', 'b'],
      brandSlug: ['alpha', 'zeta'],
      categorySlug: 'stoves',
      direction: 'asc',
      enumFilter: ['z'],
      numberFilter: ['a', 'b'],
      page: '1',
      search: 'stove',
      sort: 'property:weight'
    })

    expect(itemsRequest.searchParams.get('batch')).toBeNull()
    expect(itemsRequest.searchParams.get('compare')).toBeNull()

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const searchInput = searchRegion.getByLabel('Search gear')
    const categorySelect = searchRegion.getByLabel('Category')
    const sortSelect = searchRegion.getByLabel('Sort by')
    const directionSelect = searchRegion.getByLabel('Direction')
    const clearButton = searchRegion.getByRole('button', { name: 'Clear search' })
    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })

    await expect(sortSelect.getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)
    await searchInput.focus()
    await page.keyboard.press('Tab')
    await expect(clearButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(categorySelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sortSelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(directionSelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(detailLink).toBeFocused()
    await expect(page.getByText('83 g', { exact: true })).toBeVisible()
    await expect(page.getByText('Canister', { exact: true })).toBeVisible()
    await expect(page.getByText('Yes', { exact: true })).toBeVisible()
  })

  test('should expose a touch-sized clear search action and restore input focus', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const searchInput = page.getByLabel('Search gear')

    await searchInput.fill('rocket')
    await expectRouteSearch(page, '?q=rocket')
    await expect.poll(() => tracker.items.length).toBeGreaterThan(1)

    const clearButton = page.getByRole('button', { name: 'Clear search' })
    const clearButtonBox = await getElementBox(clearButton)

    expect(clearButtonBox.width).toBeGreaterThanOrEqual(44)
    expect(clearButtonBox.height).toBeGreaterThanOrEqual(44)

    await clearButton.focus()
    await page.keyboard.press('Enter')

    await expect(searchInput).toHaveValue('')
    await expect(searchInput).toBeFocused()
    await expect(clearButton).toHaveCount(0)
    await expectRouteSearch(page, '')
  })

  test('should map search and sorting to the API while preserving route history and future state', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    const preservedEntries: QueryEntry[] = [
      ['brand', 'msr'],
      ['number', 'weight:gte:80'],
      ['enum', 'fuel-type:canister'],
      ['boolean', 'piezo-ignition:true'],
      ['batch', '2'],
      ['compare', 'second'],
      ['compare', 'first']
    ]

    const initialSearch = buildRouteSearch([
      ['q', 'old'],
      ...preservedEntries
    ])

    await openGearLibrary(page, `/gear-library${initialSearch}`)

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const searchInput = searchRegion.getByLabel('Search gear')
    const categorySelect = searchRegion.getByLabel('Category')
    const sortSelect = searchRegion.getByLabel('Sort by')
    const directionSelect = searchRegion.getByLabel('Direction')

    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const categorySearch = buildRouteSearch([
      ['q', 'old'],
      ['category', 'stoves'],
      ...preservedEntries
    ])

    await expectRouteSearch(page, categorySearch)
    await expect(sortSelect.getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)

    const itemsBeforeSearch = tracker.items.length

    await searchInput.fill('rocket')
    await page.waitForTimeout(100)

    expect(tracker.items).toHaveLength(itemsBeforeSearch)
    await expectRouteSearch(page, categorySearch)

    const searchedRequest = await waitForNextItemsRequest(tracker, itemsBeforeSearch)

    const searchedRoute = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ...preservedEntries
    ])

    await expectRouteSearch(page, searchedRoute)

    expectQueryValues(searchedRequest, {
      booleanFilter: ['piezo-ignition:true'],
      brandSlug: ['msr'],
      categorySlug: 'stoves',
      direction: 'asc',
      enumFilter: ['fuel-type:canister'],
      numberFilter: ['weight:gte:80'],
      page: '1',
      search: 'rocket',
      sort: 'name'
    })

    await page.goBack()
    await expectRouteSearch(page, initialSearch)
    await expect(searchInput).toHaveValue('old')
    await expect(categorySelect).toHaveValue('')

    await page.goForward()
    await expectRouteSearch(page, searchedRoute)
    await expect(searchInput).toHaveValue('rocket')
    await expect(categorySelect).toHaveValue('stoves')
    await expect(sortSelect.getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)

    const itemsBeforeSort = tracker.items.length

    await sortSelect.selectOption('property:weight')
    await waitForNextItemsRequest(tracker, itemsBeforeSort)

    const sortedRoute = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ...preservedEntries.slice(0, 4),
      ['sort', 'property:weight'],
      ...preservedEntries.slice(4)
    ])

    await expectRouteSearch(page, sortedRoute)

    const itemsBeforeDirection = tracker.items.length

    await directionSelect.selectOption('desc')
    const directedRequest = await waitForNextItemsRequest(tracker, itemsBeforeDirection)
    const directedRoute = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ...preservedEntries.slice(0, 4),
      ['sort', 'property:weight'],
      ['direction', 'desc'],
      ...preservedEntries.slice(4)
    ])

    await expectRouteSearch(page, directedRoute)

    expectQueryValues(directedRequest, {
      direction: 'desc',
      page: '1',
      search: 'rocket',
      sort: 'property:weight'
    })

    await page.reload()

    const loginUrl = new globalThis.URL(page.url())
    const redirectTarget = loginUrl.searchParams.get('redirectTo')

    expect(redirectTarget).not.toBeNull()

    const redirectUrl = new globalThis.URL(String(redirectTarget), loginUrl.origin)
    const expectedRedirectSearch = new globalThis.URLSearchParams(directedRoute).toString()

    expect(loginUrl.pathname).toBe('/login')
    expect(redirectUrl.pathname).toBe('/gear-library')
    expect(redirectUrl.searchParams.toString()).toBe(expectedRedirectSearch)

    const requestsBeforeRestore = tracker.items.length

    await page.getByRole('button', { name: 'Guest' }).click()
    await waitForNextItemsRequest(tracker, requestsBeforeRestore)
    await expectRouteSearch(page, directedRoute)
    await expect(searchInput).toHaveValue('rocket')
    await expect(categorySelect).toHaveValue('stoves')
    await expect(sortSelect).toHaveValue('property:weight')
    await expect(directionSelect).toHaveValue('desc')
  })

  test('should reset property sorting when the category changes', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = page.getByLabel('Category')
    const sortSelect = page.getByLabel('Sort by')
    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)
    await expect(sortSelect.getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)

    const itemsBeforePropertySort = tracker.items.length

    await sortSelect.selectOption('property:weight')
    await waitForNextItemsRequest(tracker, itemsBeforePropertySort)
    await expectRouteSearch(page, '?category=stoves&sort=property%3Aweight')

    const itemsBeforeClearingCategory = tracker.items.length

    await categorySelect.selectOption('')
    const clearedCategoryRequest = await waitForNextItemsRequest(tracker, itemsBeforeClearingCategory)

    await expectRouteSearch(page, '')
    await expect(sortSelect).toHaveValue('name')

    expect(clearedCategoryRequest.searchParams.get('categorySlug')).toBeNull()
    expect(clearedCategoryRequest.searchParams.get('sort')).toBe('name')

    await expect(page.getByText('Could not refresh results.')).toHaveCount(0)
  })

  test('should abort stale category requests when the selection changes', async ({ context, page }) => {
    const itemsGate = createDeferred()
    const categoryDetailGate = createDeferred()
    const mockConfig = createStaleCategoryRequestConfig(itemsGate, categoryDetailGate)
    const tracker = await mockCatalogApi(context, mockConfig)

    await openGearLibrary(page)

    const categorySelect = page.getByLabel('Category')

    await categorySelect.selectOption('stoves')

    await expect.poll(() => {
      const hasItemsRequest = tracker.items.some((request) => (
        request.searchParams.get('categorySlug') === 'stoves'
      ))
      const hasCategoryDetailRequest = tracker.categoryDetails.some((request) => (
        request.pathname.endsWith('/stoves')
      ))

      return {
        hasCategoryDetailRequest,
        hasItemsRequest
      }
    }).toStrictEqual({
      hasCategoryDetailRequest: true,
      hasItemsRequest: true
    })

    const itemsFailurePromise = page.waitForEvent('requestfailed', isStovesItemsRequest)
    const categoryDetailFailurePromise = page.waitForEvent('requestfailed', isStovesCategoryDetailRequest)

    await categorySelect.selectOption('sleeping-pads')

    const [itemsFailure, categoryDetailFailure] = await Promise.all([
      itemsFailurePromise,
      categoryDetailFailurePromise
    ])

    expect(itemsFailure.failure()?.errorText).toContain('ERR_ABORTED')
    expect(categoryDetailFailure.failure()?.errorText).toContain('ERR_ABORTED')

    itemsGate.resolve()
    categoryDetailGate.resolve()

    await expect(page.getByRole('link', { name: 'NeoAir XLite NXT' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toHaveCount(0)
    await expect(page.getByLabel('Sort by').getByRole('option', { name: 'R-value' })).toHaveCount(1)
  })

  test('should keep pagination local and drop unsupported query keys on the next legitimate write', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      items: respondWithPagination
    })

    await openGearLibrary(page, '/gear-library?page=999&debug=1')
    await expectRouteSearch(page, '?page=999&debug=1')
    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const initialRequest = getLastRequest(tracker.items)

    expect(initialRequest.searchParams.get('page')).toBe('1')

    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('Page 1 of 2')).toBeVisible()

    const itemsBeforeNextPage = tracker.items.length

    await page.getByRole('button', { name: 'Next' }).click()

    const nextPageRequest = await waitForNextItemsRequest(tracker, itemsBeforeNextPage)

    expect(nextPageRequest.searchParams.get('page')).toBe('2')

    await expectRouteSearch(page, '?page=999&debug=1')
    await expect(page.getByText('WhisperLite Universal')).toBeVisible()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()

    const itemsBeforePreviousPage = tracker.items.length

    await page.getByRole('button', { name: 'Previous' }).click()

    const previousPageRequest = await waitForNextItemsRequest(tracker, itemsBeforePreviousPage)

    expect(previousPageRequest.searchParams.get('page')).toBe('1')

    await expectRouteSearch(page, '?page=999&debug=1')

    const itemsBeforeSort = tracker.items.length

    await page.getByLabel('Sort by').selectOption('brand')

    const sortedRequest = await waitForNextItemsRequest(tracker, itemsBeforeSort)

    expectQueryValues(sortedRequest, {
      page: '1',
      sort: 'brand'
    })

    await expectRouteSearch(page, '?sort=brand')
  })

  test('should distinguish an empty catalog from an empty filtered result', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      items: respondWithEmptyItems
    })

    await openGearLibrary(page)

    await expect(page.getByText('0 items')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No items yet.' })).toBeVisible()

    const itemsBeforeSearch = tracker.items.length

    await page.getByLabel('Search gear').fill('tent')
    await waitForNextItemsRequest(tracker, itemsBeforeSearch)

    await expectRouteSearch(page, '?q=tent')
    await expect(page.getByRole('heading', { name: 'No matching gear.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No items yet.' })).toHaveCount(0)
  })

  test('should keep result width stable across list and placeholder states', async ({ context, page }) => {
    const itemsState: MutableResponseState = {
      response: { json: firstPageResponse }
    }

    const tracker = await mockCatalogApi(context, {
      items: respondFromState(itemsState)
    })

    await openGearLibrary(page)

    const listShell = page.getByRole('list').locator('..')
    const resultsBody = page.getByTestId('gear-library-results-body')
    const listBox = await getElementBox(listShell)
    const resultsBox = await getElementBox(resultsBody)
    const itemsBeforeSearch = tracker.items.length

    itemsState.response = { json: emptyResponse }

    await page.getByLabel('Search gear').fill('tent')
    await waitForNextItemsRequest(tracker, itemsBeforeSearch)
    await expect(page.getByRole('heading', { name: 'No matching gear.' })).toBeVisible()

    const placeholderCard = page.getByTestId('gear-library-results-state').locator(':scope > *')
    const placeholderBox = await getElementBox(placeholderCard)
    const emptyResultsBox = await getElementBox(resultsBody)
    const scrollbarGutter = await page.evaluate(() => (
      globalThis.getComputedStyle(globalThis.document.documentElement).scrollbarGutter
    ))

    expect(placeholderBox.width).toBeCloseTo(listBox.width, 0)
    expect(emptyResultsBox.width).toBeCloseTo(resultsBox.width, 0)
    expect(scrollbarGutter).toBe('stable')
  })

  test('should keep filter geometry stable while category details load', async ({ context, page }) => {
    const categoryDetailGate = createDeferred()

    await mockCatalogApi(context, {
      categoryDetail: () => {
        return {
          json: stovesCategoryResponse,
          waitFor: categoryDetailGate.promise
        }
      }
    })

    await openGearLibrary(page)

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const resultsBody = page.getByTestId('gear-library-results-body')
    const sortSelect = searchRegion.getByLabel('Sort by')
    const searchBoxBefore = await getElementBox(searchRegion)
    const resultsBoxBefore = await getElementBox(resultsBody)

    await searchRegion.getByLabel('Category').selectOption('stoves')
    await expect(sortSelect).toBeDisabled()
    await expect(page.getByTestId('gear-library-sort-progress')).toBeVisible()

    const searchBoxDuring = await getElementBox(searchRegion)
    const resultsBoxDuring = await getElementBox(resultsBody)

    expect(searchBoxDuring.height).toBeCloseTo(searchBoxBefore.height, 1)
    expect(resultsBoxDuring.y).toBeCloseTo(resultsBoxBefore.y, 1)
    await expect(page.getByText('Loading category details', { exact: true })).toHaveCount(0)

    categoryDetailGate.resolve()

    await expect(sortSelect).toBeEnabled()
    await expect(sortSelect.getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)
  })

  test('should expose the initial loading state and recover from an initial items failure', async ({ context, page }) => {
    const initialRequestGate = createDeferred()

    const itemsState: MutableResponseState = {
      response: {
        ...serverErrorResponse,
        waitFor: initialRequestGate.promise
      }
    }

    const tracker = await mockCatalogApi(context, {
      items: respondFromState(itemsState)
    })

    const redirectTo = encodeURIComponent('/gear-library')

    await page.goto(`/login?redirectTo=${redirectTo}`)

    const loginClickPromise = page.getByRole('button', { name: 'Guest' }).click()

    const initialProgress = page.getByTestId('gear-library-initial-progress')
    const resultsSkeleton = page.getByTestId('gear-library-results-skeleton')

    await expect(initialProgress).toBeVisible()
    await expect(resultsSkeleton).toBeVisible()
    await expect(resultsSkeleton).toHaveAttribute('data-visible', 'true')

    const initialProgressBox = await getElementBox(initialProgress)
    const resultsSkeletonBox = await getElementBox(resultsSkeleton)

    expect(initialProgressBox.height).toBeLessThanOrEqual(2)
    expect(resultsSkeletonBox.height).toBeLessThan(240)

    initialRequestGate.resolve()

    await loginClickPromise

    await expect(page.getByRole('heading', { name: 'Gear library unavailable.' })).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toHaveCount(0)

    const itemsBeforeRetry = tracker.items.length

    itemsState.response = { json: firstPageResponse }

    await page.getByRole('button', { name: 'Retry' }).click()
    await waitForNextItemsRequest(tracker, itemsBeforeRetry)
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
  })

  test('should preserve rendered rows through refresh and recover from a refresh failure', async ({ context, page }) => {
    const refreshRequestGate = createDeferred()

    const itemsState: MutableResponseState = {
      response: { json: firstPageResponse }
    }

    const tracker = await mockCatalogApi(context, {
      items: respondFromState(itemsState)
    })

    await openGearLibrary(page)
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    const list = page.getByRole('list')
    const listBoxBefore = await getElementBox(list)

    const itemsBeforeSearch = tracker.items.length

    itemsState.response = {
      ...serverErrorResponse,
      waitFor: refreshRequestGate.promise
    }

    await page.getByLabel('Search gear').fill('rocket')
    await expect.poll(() => tracker.items.length).toBeGreaterThan(itemsBeforeSearch)

    const refreshProgress = page.getByTestId('gear-library-refresh-progress')

    await expect(refreshProgress).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    const refreshStatus = page.getByText('Refreshing results', { exact: true })
    const refreshStatusBox = await getElementBox(refreshStatus)

    expect(refreshStatusBox.width).toBe(1)
    expect(refreshStatusBox.height).toBe(1)

    const listBoxDuring = await getElementBox(list)

    expect(listBoxDuring.y).toBeCloseTo(listBoxBefore.y, 1)
    expect(listBoxDuring.height).toBeCloseTo(listBoxBefore.height, 1)

    refreshRequestGate.resolve()

    const refreshAlert = page.getByRole('alert').filter({ hasText: 'Could not refresh results.' })

    await expect(refreshAlert).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    itemsState.response = { json: refreshedSearchResponse }

    await refreshAlert.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('link', { name: 'WhisperLite Universal' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toHaveCount(0)
    await expect(refreshAlert).toHaveCount(0)
    await expectRouteSearch(page, '?q=rocket')
  })

  test('should render cached rows immediately and revalidate after client navigation', async ({ context, page }) => {
    const returnRequestGate = createDeferred()

    const itemsState: MutableResponseState = {
      response: { json: firstPageResponse }
    }

    const tracker = await mockCatalogApi(context, {
      items: respondFromState(itemsState)
    })

    await openGearLibrary(page)
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    itemsState.response = {
      json: refreshedSearchResponse,
      waitFor: returnRequestGate.promise
    }

    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Home' }).click()
    await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe('/')

    const itemsBeforeReturn = tracker.items.length

    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Gear library' }).click()
    await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe('/gear-library')
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByTestId('gear-library-initial-progress')).toHaveCount(0)
    await expect.poll(() => tracker.items.length).toBeGreaterThan(itemsBeforeReturn)

    const listBoxBefore = await getElementBox(page.getByRole('list'))

    await expect(page.getByTestId('gear-library-refresh-progress')).toBeVisible()

    const listBoxDuring = await getElementBox(page.getByRole('list'))

    expect(listBoxDuring.y).toBeCloseTo(listBoxBefore.y, 1)

    returnRequestGate.resolve()

    await expect(page.getByRole('link', { name: 'WhisperLite Universal' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toHaveCount(0)
    await expect(page.getByTestId('gear-library-refresh-progress')).toBeHidden()
  })

  test('should keep results usable while category requests fail and retry each request independently', async ({ context, page }) => {
    const categoriesState: MutableResponseState = {
      response: serverErrorResponse
    }

    const categoryDetailState: MutableResponseState = {
      response: serverErrorResponse
    }

    const tracker = await mockCatalogApi(context, {
      categories: respondFromState(categoriesState),
      categoryDetail: respondFromState(categoryDetailState)
    })

    await openGearLibrary(page)

    const categoriesAlert = page.getByRole('alert').filter({ hasText: 'Categories unavailable.' })
    const itemLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })

    await expect(categoriesAlert).toBeVisible()
    await expect(itemLink).toBeVisible()

    const categoriesBeforeRetry = tracker.categories.length

    categoriesState.response = { json: categoriesResponse }

    await categoriesAlert.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => tracker.categories.length).toBeGreaterThan(categoriesBeforeRetry)

    const categorySelect = page.getByLabel('Category')

    await expect(categorySelect.getByRole('option', { name: 'Stoves' })).toHaveCount(1)
    await categorySelect.selectOption('stoves')

    const propertySortAlert = page.getByRole('alert').filter({ hasText: 'Property sorting unavailable.' })

    await expect(propertySortAlert).toBeVisible()
    await expect(itemLink).toBeVisible()

    const categoryDetailsBeforeRetry = tracker.categoryDetails.length

    categoryDetailState.response = { json: stovesCategoryResponse }

    await propertySortAlert.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => tracker.categoryDetails.length).toBeGreaterThan(categoryDetailsBeforeRetry)

    await expect(page.getByLabel('Sort by').getByRole('option', { name: 'Weight (g)' })).toHaveCount(1)
  })
})
