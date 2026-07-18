import type { BrowserContext, Locator, Page, Request, Route } from '@playwright/test'
import type {
  GearLibraryEntityDetail,
  GearLibraryItemsResponse,
  GearLibraryListItem,
  ItemDetailResponse
} from '../../../app/types/equipment'
import type { CategoryDetailResponse } from '../../../server/api/equipment/categories/by-slug/[slug].get'
import { expect, test } from '../fixtures/global.fixtures.ts'

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
  brands?: CatalogResponder;
  categories?: CatalogResponder;
  categoryDetail?: CatalogResponder;
  items?: CatalogResponder;
}

interface CatalogRequestTracker {
  brands: ParsedUrl[];
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

interface LoadMoreFailureState {
  shouldFail: boolean;
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
    dataType: 'enum',
    enumOptionName: 'Liquid fuel',
    name: 'Fuel type',
    slug: 'fuel-type',
    unit: null,
    value: 'liquid-fuel'
  }, {
    dataType: 'number',
    name: 'Weight',
    slug: 'weight',
    unit: 'g',
    value: 83
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
  limit: 10,
  page: 1,
  total: 3
}

const scrollableItemsResponse: GearLibraryItemsResponse = {
  items: Array.from({ length: 8 }, (_value, index) => {
    return {
      ...stoveItem,
      id: `0195f6e8-8f44-74f6-bc9a-${String(index).padStart(12, '0')}`,
      name: `PocketRocket Deluxe ${index + 1}`
    }
  }),
  limit: 10,
  page: 1,
  total: 8
}

const refreshedSearchResponse: GearLibraryItemsResponse = {
  items: [secondPageItem],
  limit: 10,
  page: 1,
  total: 1
}

const sleepingPadsResponse: GearLibraryItemsResponse = {
  items: [sleepingPadItem],
  limit: 10,
  page: 1,
  total: 1
}

const emptyResponse: GearLibraryItemsResponse = {
  items: [],
  limit: 10,
  page: 1,
  total: 0
}

const loadMoreItems: GearLibraryListItem[] = Array.from({ length: 23 }, (_value, index) => {
  const itemNumber = index + 1

  return {
    ...stoveItem,
    id: `0195f6e8-8f44-74f6-bc9a-${String(100 + index).padStart(12, '0')}`,
    name: `Catalog item ${String(itemNumber).padStart(2, '0')}`
  }
})

const loadMoreResponses: GearLibraryItemsResponse[] = [
  {
    items: loadMoreItems.slice(0, 10),
    limit: 10,
    page: 1,
    total: loadMoreItems.length
  },
  {
    items: loadMoreItems.slice(10, 20),
    limit: 10,
    page: 2,
    total: loadMoreItems.length
  },
  {
    items: loadMoreItems.slice(20),
    limit: 10,
    page: 3,
    total: loadMoreItems.length
  }
]

const categoriesResponse: GearLibraryEntityDetail[] = [{
  id: 2,
  name: 'Stoves',
  slug: 'stoves'
}, {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads'
}]

const brandsResponse: GearLibraryEntityDetail[] = [{
  id: 12,
  name: 'Therm-a-Rest',
  slug: 'therm-a-rest'
}, {
  id: 10,
  name: 'MSR',
  slug: 'msr'
}, {
  id: 1,
  name: 'Alpkit',
  slug: 'alpkit'
}, {
  id: 2,
  name: 'Big Agnes',
  slug: 'big-agnes'
}, {
  id: 3,
  name: 'Black Diamond',
  slug: 'black-diamond'
}, {
  id: 4,
  name: 'Coleman',
  slug: 'coleman'
}, {
  id: 5,
  name: 'Exped',
  slug: 'exped'
}, {
  id: 6,
  name: 'Fjällräven',
  slug: 'fjallraven'
}, {
  id: 7,
  name: 'GSI Outdoors',
  slug: 'gsi-outdoors'
}, {
  id: 8,
  name: 'Jetboil',
  slug: 'jetboil'
}, {
  id: 9,
  name: 'Marmot',
  slug: 'marmot'
}, {
  id: 11,
  name: 'NEMO',
  slug: 'nemo'
}]

const filterLimitBrandsResponse: GearLibraryEntityDetail[] = Array.from(
  { length: 21 },
  (_value, index) => {
    const number = String(index + 1).padStart(2, '0')

    return {
      id: 100 + index,
      name: `Brand ${number}`,
      slug: `brand-${number}`
    }
  }
)

const stovesCategoryResponse: CategoryDetailResponse = {
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
    dataType: 'enum',

    enumOptions: [{
      id: 31,
      name: 'Canister',
      slug: 'canister'
    }, {
      id: 32,
      name: 'Liquid fuel',
      slug: 'liquid-fuel'
    }],

    id: 23,
    name: 'Fuel type',
    slug: 'fuel-type',
    unit: null
  }, {
    dataType: 'boolean',
    id: 22,
    name: 'Piezo ignition',
    slug: 'piezo-ignition',
    unit: null
  }]
}

const sleepingPadsCategoryResponse: CategoryDetailResponse = {
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

const filterLimitCategoryResponse: CategoryDetailResponse = {
  id: 2,
  name: 'Stoves',
  slug: 'stoves',

  properties: [{
    dataType: 'number',
    id: 101,
    name: 'Active number',
    slug: 'active-number',
    unit: null
  }, {
    dataType: 'number',
    id: 102,
    name: 'Available number',
    slug: 'available-number',
    unit: null
  }, {
    dataType: 'enum',

    enumOptions: Array.from({ length: 19 }, (_value, index) => {
      const number = String(index + 1).padStart(2, '0')

      return {
        id: 200 + index,
        name: `Option ${number}`,
        slug: `option-${number}`
      }
    }),

    id: 103,
    name: 'Filter option',
    slug: 'filter-option',
    unit: null
  }, {
    dataType: 'boolean',
    id: 104,
    name: 'Active boolean',
    slug: 'active-boolean',
    unit: null
  }, {
    dataType: 'boolean',
    id: 105,
    name: 'Available boolean',
    slug: 'available-boolean',
    unit: null
  }]
}

const serverErrorResponse: ApiMockResponse = {
  status: 500,

  json: {
    statusCode: 500
  }
}

const malformedNumberFilter = 'invalid'

function respondToMalformedNumberFilter(request: CatalogRequest): ApiMockResponse {
  const numberFilters = request.url.searchParams.getAll('numberFilter')
  const hasMalformedNumberFilter = numberFilters.includes(malformedNumberFilter)

  if (hasMalformedNumberFilter) {
    return {
      status: 400,

      json: {
        statusCode: 400
      }
    }
  }

  return { json: firstPageResponse }
}

function respondWithEmptyItems(): ApiMockResponse {
  return { json: emptyResponse }
}

function respondWithLoadMore(request: CatalogRequest): ApiMockResponse {
  const requestedPage = Number(request.url.searchParams.get('page') ?? '1')
  const response = loadMoreResponses[requestedPage - 1] ?? emptyResponse

  return { json: response }
}

function createGatedLoadMoreResponder(gatedPage: string, gate: Deferred): CatalogResponder {
  return (request) => {
    const response = respondWithLoadMore(request)
    const requestedPage = request.url.searchParams.get('page')
    const shouldWait = requestedPage === gatedPage

    if (shouldWait) {
      return { ...response, waitFor: gate.promise }
    }

    return response
  }
}

function createFailingLoadMoreResponder(
  failingPage: string,
  state: LoadMoreFailureState
): CatalogResponder {
  return (request) => {
    const requestedPage = request.url.searchParams.get('page')
    const shouldFail = requestedPage === failingPage && state.shouldFail

    if (shouldFail) {
      return serverErrorResponse
    }

    return respondWithLoadMore(request)
  }
}

function createStaleLoadMoreResponder(secondPageGate: Deferred): CatalogResponder {
  return (request) => {
    const response = respondWithLoadMore(request)
    const requestedPage = request.url.searchParams.get('page')
    const search = request.url.searchParams.get('search')
    const isSecondPage = requestedPage === '2'

    if (isSecondPage) {
      return { ...response, waitFor: secondPageGate.promise }
    }

    const isRefreshedSearch = search === 'whisper'

    if (isRefreshedSearch) {
      return { json: refreshedSearchResponse }
    }

    return response
  }
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
    brands: [],
    categories: [],
    categoryDetails: [],
    items: []
  }

  await context.route((url) => url.pathname === '/api/equipment/brands', async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())

    tracker.brands.push(requestUrl)

    const request = {
      count: tracker.brands.length,
      url: requestUrl
    }

    const fallback = { json: brandsResponse }
    const response = await resolveMockResponse(config.brands, request, fallback)

    await fulfillMockResponse(route, response)
  })

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

    const fallbackCategory = requestUrl.pathname.endsWith('/sleeping-pads')
      ? sleepingPadsCategoryResponse
      : stovesCategoryResponse
    const fallback = { json: fallbackCategory }
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

async function mockItemDetailApi(context: BrowserContext, item: GearLibraryListItem): Promise<void> {
  const itemDetailResponse: ItemDetailResponse = {
    createdAt: '2026-07-18T00:00:00.000Z',
    id: item.id,
    name: item.name,
    properties: item.properties,

    brand: {
      id: 1,
      name: item.brand.name,
      slug: item.brand.slug
    },

    category: {
      id: 2,
      name: item.category.name,
      slug: item.category.slug
    }
  }

  await context.route((url) => url.pathname === `/api/equipment/items/${item.id}`, async (route) => {
    await route.fulfill({ json: itemDetailResponse })
  })

  await context.route((url) => url.pathname === '/api/user/gear', async (route) => {
    await route.fulfill({ json: [] })
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

async function openFilterDialog(page: Page): Promise<Locator> {
  const filtersButton = page.getByRole('button', { name: /^Filters(?: \d+)?$/u })

  await filtersButton.click()

  const filterDialog = page.getByRole('dialog', { name: 'Filters' })

  await expect(filterDialog).toBeVisible()

  return filterDialog
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

function getRequiredLoadMoreItem(index: number): GearLibraryListItem {
  const item = loadMoreItems.at(index)

  if (item === undefined) {
    throw new Error('Expected a load-more item fixture')
  }

  return item
}

async function getRequiredHref(locator: Locator): Promise<string> {
  const href = await locator.getAttribute('href')

  if (href === null) {
    throw new Error('Expected the element to have an href')
  }

  return href
}

async function hasHistoryStateKey(page: Page, key: string): Promise<boolean> {
  const historyState = await page.evaluate((): unknown => (
    globalThis.history.state as unknown
  ))

  return typeof historyState === 'object'
    && historyState !== null
    && key in historyState
}

async function clearGearLibraryItemsSnapshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- page.evaluate callbacks must be self-contained.
    function getRequiredProperty(value: unknown, key: string): unknown {
      const isObject = typeof value === 'object' && value !== null

      if (isObject === false) {
        throw new Error(`Expected an object containing ${key}`)
      }

      return Reflect.get(value, key)
    }

    const nuxtRoot = globalThis.document.querySelector('#__nuxt')
    const vueApp: unknown = nuxtRoot === null
      ? undefined
      : Reflect.get(nuxtRoot, '__vue_app__')
    const vueAppConfig = getRequiredProperty(vueApp, 'config')
    const globalProperties = getRequiredProperty(vueAppConfig, 'globalProperties')
    const nuxtApp = getRequiredProperty(globalProperties, '$nuxt')
    const nuxtPayload = getRequiredProperty(nuxtApp, 'payload')
    const nuxtState = getRequiredProperty(nuxtPayload, 'state')
    const gearLibraryCache = getRequiredProperty(nuxtState, '$sgear-library-cache')
    const hasCache = typeof gearLibraryCache === 'object' && gearLibraryCache !== null

    if (hasCache === false) {
      throw new Error('Expected the Nuxt gear library cache state')
    }

    Reflect.deleteProperty(gearLibraryCache, 'items')
  })
}

async function getScrollDistance(page: Page, expectedScrollTop: number): Promise<number> {
  const scrollTop = await page.evaluate(() => globalThis.scrollY)

  return Math.abs(scrollTop - expectedScrollTop)
}

function isStovesItemsRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/equipment/items'
    && requestUrl.searchParams.get('categorySlug') === 'stoves'
}

function isSecondPageItemsRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())
  const isItemsRequest = requestUrl.pathname === '/api/equipment/items'
  const isSecondPage = requestUrl.searchParams.get('page') === '2'

  return isItemsRequest && isSecondPage
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

async function hasVisibleFocusOutline(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const style = globalThis.getComputedStyle(element)

    return style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
  })
}

async function waitForInlineEndAnchoring(locator: Locator, inlineEnd: number): Promise<void> {
  await expect.poll(async () => {
    const box = await getElementBox(locator)

    return Math.round(box.x + box.width)
  }).toBe(inlineEnd)
}

async function waitForBlockEndAnchoring(locator: Locator, blockEnd: number): Promise<void> {
  await expect.poll(async () => {
    const box = await getElementBox(locator)

    return Math.round(box.y + box.height)
  }).toBe(blockEnd)
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

    await expect(page.getByRole('heading', { name: 'Gear library', exact: true })).toBeVisible()
    await expect(searchRegion.getByLabel('Search gear')).toHaveAttribute('type', 'search')
    await expect(categorySelect).toHaveValue('')
    await expect(sortSelect).toHaveValue('name:asc')
    await expect(sortSelect.locator('option')).toHaveText([
      'Name: A–Z',
      'Name: Z–A',
      'Brand: A–Z',
      'Brand: Z–A'
    ])
    await expect(page.getByRole('complementary', { name: 'Catalog filters' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()

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
    await expect(itemRow.getByText('Liquid fuel', { exact: true })).toBeVisible()
    await expect(itemRow.getByText('liquid-fuel', { exact: true })).toHaveCount(0)
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

  test('should keep separated items with three properties in one compact row', async ({ context, page }) => {
    await page.setViewportSize({
      height: 768,
      width: 1024
    })

    await mockCatalogApi(context)
    await openGearLibrary(page)

    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })
    const itemRow = page.getByRole('listitem').filter({ has: detailLink })
    const secondDetailLink = page.getByRole('link', { name: 'NeoAir XLite NXT' })
    const secondItemRow = page.getByRole('listitem').filter({ has: secondDetailLink })
    const resultsList = page.getByRole('list').filter({ has: detailLink })
    const weightLabel = itemRow.getByText('Weight', { exact: true })
    const fuelTypeLabel = itemRow.getByText('Fuel type', { exact: true })
    const piezoIgnitionLabel = itemRow.getByText('Piezo ignition', { exact: true })
    const weightProperty = weightLabel.locator('..')
    const weightValue = itemRow.getByText('83 g', { exact: true })
    const fuelTypeValue = itemRow.getByText('Liquid fuel', { exact: true })
    const piezoIgnitionValue = itemRow.getByText('Yes', { exact: true })

    await expect(resultsList).toHaveAttribute('role', 'list')
    await expect(itemRow.getByRole('link')).toHaveCount(1)
    await expect(itemRow.locator('dt')).toHaveText(['Weight', 'Fuel type', 'Piezo ignition'])
    await expect(secondItemRow.locator('dt')).toHaveText(['R-value', 'Insulation', 'Pump sack'])

    await detailLink.hover()
    await expect(detailLink).toHaveCSS('text-decoration-line', 'none')
    await expect(weightProperty).toHaveCSS('border-left-width', '1px')

    const desktopRowBox = await getElementBox(itemRow)
    const desktopSecondRowBox = await getElementBox(secondItemRow)
    const desktopWeightBox = await getElementBox(weightLabel)
    const desktopFuelTypeBox = await getElementBox(fuelTypeLabel)
    const desktopPiezoIgnitionBox = await getElementBox(piezoIgnitionLabel)
    const desktopWeightValueBox = await getElementBox(weightValue)
    const desktopFuelTypeValueBox = await getElementBox(fuelTypeValue)
    const desktopPiezoIgnitionValueBox = await getElementBox(piezoIgnitionValue)
    const desktopItemGap = desktopSecondRowBox.y - desktopRowBox.y - desktopRowBox.height

    expect(desktopRowBox.height).toBeLessThan(120)
    expect(desktopItemGap).toBeCloseTo(8, 0)
    expect(desktopFuelTypeBox.y).toBeCloseTo(desktopWeightBox.y, 0)
    expect(desktopPiezoIgnitionBox.y).toBeCloseTo(desktopWeightBox.y, 0)
    expect(desktopFuelTypeValueBox.y).toBeCloseTo(desktopWeightValueBox.y, 0)
    expect(desktopPiezoIgnitionValueBox.y).toBeCloseTo(desktopWeightValueBox.y, 0)

    await page.setViewportSize({
      height: 844,
      width: 390
    })

    await expect.poll(async () => page.evaluate(() => globalThis.innerWidth)).toBe(390)

    const mobileRowBox = await getElementBox(itemRow)
    const mobileSecondRowBox = await getElementBox(secondItemRow)
    const mobileWeightBox = await getElementBox(weightLabel)
    const mobileFuelTypeBox = await getElementBox(fuelTypeLabel)
    const mobilePiezoIgnitionBox = await getElementBox(piezoIgnitionLabel)
    const mobileWeightValueBox = await getElementBox(weightValue)
    const mobileFuelTypeValueBox = await getElementBox(fuelTypeValue)
    const mobilePiezoIgnitionValueBox = await getElementBox(piezoIgnitionValue)
    const mobileItemGap = mobileSecondRowBox.y - mobileRowBox.y - mobileRowBox.height

    expect(mobileRowBox.height).toBeLessThan(160)
    expect(mobileItemGap).toBeCloseTo(8, 0)
    expect(mobileFuelTypeBox.y).toBeCloseTo(mobileWeightBox.y, 0)
    expect(mobilePiezoIgnitionBox.y).toBeCloseTo(mobileWeightBox.y, 0)
    expect(mobileFuelTypeValueBox.y).toBeCloseTo(mobileWeightValueBox.y, 0)
    expect(mobilePiezoIgnitionValueBox.y).toBeCloseTo(mobileWeightValueBox.y, 0)
    await expect(weightProperty).toHaveCSS('border-left-width', '0px')

    await detailLink.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(detailLink).toBeFocused()
    await expect(detailLink).toHaveCSS('text-decoration-line', 'none')

    const focusedCardShadow = await itemRow.evaluate(
      (element) => globalThis.getComputedStyle(element).boxShadow
    )

    expect(focusedCardShadow).not.toBe('none')

    await detailLink.evaluate((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault()
        element.toggleAttribute('data-card-clicked', true)
      }, { once: true })
    })

    const cardClickBox = await getElementBox(itemRow)
    const cardClickInlinePosition = cardClickBox.x + 8
    const cardClickBlockPosition = cardClickBox.y + 8

    await page.mouse.click(cardClickInlinePosition, cardClickBlockPosition)
    await expect(detailLink).toHaveAttribute('data-card-clicked')
  })

  test('should keep the filter side sheet and sticky trigger on every desktop width', async ({ context, page }) => {
    await page.setViewportSize({
      height: 768,
      width: 1024
    })

    const tracker = await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })

    await openGearLibrary(page)

    const itemsBeforeCategory = tracker.items.length

    await page.getByLabel('Category').selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const filtersButton = page.getByRole('button', { name: 'Filters', exact: true })

    await expect(page.getByRole('complementary', { name: 'Catalog filters' })).toHaveCount(0)
    await page.evaluate(() => {
      globalThis.scrollTo({
        top: globalThis.document.documentElement.scrollHeight
      })
    })
    await expect.poll(async () => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(0)
    await expect(filtersButton).toBeInViewport()

    const stickyFiltersButtonBox = await getElementBox(filtersButton)

    expect(stickyFiltersButtonBox.y).toBeGreaterThanOrEqual(0)
    expect(stickyFiltersButtonBox.y + stickyFiltersButtonBox.height).toBeLessThanOrEqual(768)

    await filtersButton.click()

    const filterDialog = page.getByRole('dialog', { name: 'Filters' })
    const filterTitle = filterDialog.getByRole('heading', { name: 'Filters' })

    await expect(filterTitle).toBeFocused()
    await waitForInlineEndAnchoring(filterDialog, 1024)

    const firstSideSheetBox = await getElementBox(filterDialog)

    expect(firstSideSheetBox.x + firstSideSheetBox.width).toBeCloseTo(1024, 0)
    expect(firstSideSheetBox.y).toBeCloseTo(0)
    expect(firstSideSheetBox.width).toBeCloseTo(384)
    expect(firstSideSheetBox.height).toBeCloseTo(768)

    const titleBoxBeforeScroll = await getElementBox(filterTitle)
    const pageScrollBeforeSideSheetScroll = await page.evaluate(() => globalThis.scrollY)

    await filterDialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    const titleBoxAfterScroll = await getElementBox(filterTitle)
    const sideSheetApplyButton = filterDialog.getByRole('button', { name: 'Apply filters' })
    const sideSheetApplyButtonBox = await getElementBox(sideSheetApplyButton)
    const pageScrollAfterSideSheetScroll = await page.evaluate(() => globalThis.scrollY)

    expect(titleBoxAfterScroll.y).toBeCloseTo(titleBoxBeforeScroll.y, 0)
    expect(sideSheetApplyButtonBox.y + sideSheetApplyButtonBox.height).toBeLessThanOrEqual(768)
    expect(pageScrollAfterSideSheetScroll).toBe(pageScrollBeforeSideSheetScroll)

    await filterDialog.getByRole('button', { name: 'Close filters' }).click()
    await page.setViewportSize({
      height: 800,
      width: 1280
    })
    await filtersButton.click()

    await waitForInlineEndAnchoring(filterDialog, 1280)

    const secondSideSheetBox = await getElementBox(filterDialog)

    expect(secondSideSheetBox.x + secondSideSheetBox.width).toBeCloseTo(1280, 0)
    expect(secondSideSheetBox.height).toBeCloseTo(800)

    const dialogBrandSearch = filterDialog.getByRole('searchbox', { name: 'Search brands' })
    const closeButton = filterDialog.getByRole('button', { name: 'Close filters' })

    await filterDialog.getByRole('button', { name: 'Show all 12 brands' }).click()
    await dialogBrandSearch.fill('msr')
    await filterDialog.getByLabel('MSR').check()

    const itemsBeforeResize = tracker.items.length

    await dialogBrandSearch.press('Enter')
    await expect(filterDialog).toBeVisible()
    await expectRouteSearch(page, '?category=stoves')
    await page.waitForTimeout(100)
    expect(tracker.items).toHaveLength(itemsBeforeResize)

    await page.setViewportSize({
      height: 900,
      width: 1440
    })

    await waitForInlineEndAnchoring(filterDialog, 1440)

    const wideSideSheetBox = await getElementBox(filterDialog)

    expect(wideSideSheetBox.x + wideSideSheetBox.width).toBeCloseTo(1440, 0)
    expect(wideSideSheetBox.y).toBeCloseTo(0)
    expect(wideSideSheetBox.width).toBeCloseTo(384)
    expect(wideSideSheetBox.height).toBeCloseTo(900)
    await expect(filterDialog).toBeVisible()
    await expect(dialogBrandSearch).toHaveValue('msr')
    await expect(filterDialog.getByLabel('MSR')).toBeChecked()
    await expect(filterDialog.getByText('1 filter selected', { exact: true })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Catalog filters' })).toHaveCount(0)
    await expectRouteSearch(page, '?category=stoves')

    await page.waitForTimeout(100)
    expect(tracker.items).toHaveLength(itemsBeforeResize)

    await closeButton.click()
    await expect(filterDialog).not.toBeVisible()
    await expect(filtersButton).toBeVisible()
    await expect(filtersButton).toBeFocused()
    await expectRouteSearch(page, '?category=stoves')

    await filtersButton.click()
    await expect(dialogBrandSearch).toHaveValue('')
    await expect(filterDialog.getByLabel('MSR')).toHaveCount(0)
    await closeButton.click()

    await page.evaluate(() => {
      globalThis.scrollTo({ top: globalThis.document.documentElement.scrollHeight })
    })
    await expect.poll(async () => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(0)
    await expect(filtersButton).toBeInViewport()

    const wideStickyFiltersButtonBox = await getElementBox(filtersButton)

    expect(wideStickyFiltersButtonBox.y).toBeGreaterThanOrEqual(0)
    expect(wideStickyFiltersButtonBox.y + wideStickyFiltersButtonBox.height)
      .toBeLessThanOrEqual(900)
  })

  test('should keep a short wide-desktop result list directly below the search controls', async ({ context, page }) => {
    await page.setViewportSize({
      height: 900,
      width: 1440
    })

    await mockCatalogApi(context, {
      items: () => {
        return { json: refreshedSearchResponse }
      }
    })

    await openGearLibrary(page)

    const searchControls = page.getByRole('search', { name: 'Gear library search' })
    const resultsLabel = page.getByText('Results', { exact: true })

    await expect(page.getByRole('link', { name: 'WhisperLite Universal' })).toBeVisible()
    await expect(page.getByText('1 item', { exact: true })).toBeVisible()

    const searchControlsBox = await getElementBox(searchControls)
    const resultsLabelBox = await getElementBox(resultsLabel)
    const searchControlsBlockEnd = searchControlsBox.y + searchControlsBox.height

    expect(resultsLabelBox.y - searchControlsBlockEnd).toBeCloseTo(24, 0)
  })

  test('should canonicalize supported state and keep the mobile keyboard order usable', async ({ context, page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    })

    const tracker = await mockCatalogApi(context)
    const route = '/gear-library?direction=sideways&sort=property%3Aweight&brand=zeta&brand=alpha&brand=alpha&q=%20stove%20&category=stoves&number=weight%3A80%3A100&enum=fuel-type%3Acanister&boolean=piezo-ignition%3Atrue&compare=second&compare=first&debug=1'

    await openGearLibrary(page, route)

    const expectedSearch = buildRouteSearch([
      ['q', 'stove'],
      ['category', 'stoves'],
      ['brand', 'alpha'],
      ['brand', 'zeta'],
      ['number', 'weight:80:100'],
      ['enum', 'fuel-type:canister'],
      ['boolean', 'piezo-ignition:true'],
      ['sort', 'property:weight'],
      ['compare', 'second'],
      ['compare', 'first']
    ])

    await expectRouteSearch(page, expectedSearch)
    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const itemsRequest = getLastRequest(tracker.items)

    expectQueryValues(itemsRequest, {
      booleanFilter: ['piezo-ignition:true'],
      brandSlug: ['alpha', 'zeta'],
      categorySlug: 'stoves',
      direction: 'asc',
      enumFilter: ['fuel-type:canister'],
      numberFilter: ['weight:80:100'],
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
    const clearButton = searchRegion.getByRole('button', { name: 'Clear search' })
    const filtersButton = page.getByRole('button', { name: 'Filters 5' })
    const appliedFilterButtons = page
      .getByRole('list', { name: 'Applied filters' })
      .getByRole('button')
    const clearAllButton = page.getByRole('button', { name: 'Clear all' })
    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })
    const resultsBody = page.getByTestId('gear-library-results-body')

    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)
    await searchInput.focus()
    await page.keyboard.press('Tab')
    await expect(clearButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(categorySelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sortSelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(filtersButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(appliedFilterButtons).toHaveCount(5)
    await expect(appliedFilterButtons.first()).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(appliedFilterButtons.last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(clearAllButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(detailLink).toBeFocused()
    await expect(resultsBody.getByText('83 g', { exact: true })).toBeVisible()
    await expect(resultsBody.getByText('Liquid fuel', { exact: true })).toBeVisible()
    await expect(resultsBody.getByText('Yes', { exact: true })).toBeVisible()
  })

  test('should expose and recover from a malformed direct URL filter', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      items: respondToMalformedNumberFilter
    })

    const route = `/gear-library?category=stoves&number=${malformedNumberFilter}`

    await openGearLibrary(page, route)

    await expect(page.getByRole('heading', { name: 'Gear library unavailable.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filters 1' })).toBeVisible()

    const itemsBeforeRemoval = tracker.items.length
    const removeFilterButton = page.getByRole('button', {
      name: `Remove Number: ${malformedNumberFilter} filter`
    })

    await removeFilterButton.click()
    await waitForNextItemsRequest(tracker, itemsBeforeRemoval)

    await expectRouteSearch(page, '?category=stoves')
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()
  })

  test('should keep filter focus indicators visible in forced colors', async ({ context, page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await mockCatalogApi(context)
    await openGearLibrary(page, '/gear-library?category=stoves&brand=msr')

    const appliedBrandFilter = page.getByRole('button', { name: 'Remove Brand: MSR filter' })
    const categorySelect = page.getByLabel('Category')
    const sortSelect = page.getByLabel('Sort by')
    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })
    const itemRow = page.getByRole('listitem').filter({ has: detailLink })

    await appliedBrandFilter.focus()
    await expect.poll(async () => hasVisibleFocusOutline(appliedBrandFilter)).toBe(true)

    await categorySelect.focus()
    await expect.poll(async () => hasVisibleFocusOutline(categorySelect)).toBe(true)

    await sortSelect.focus()
    await expect.poll(async () => hasVisibleFocusOutline(sortSelect)).toBe(true)

    await detailLink.focus()
    await expect.poll(async () => hasVisibleFocusOutline(itemRow)).toBe(true)

    const filterDialog = await openFilterDialog(page)
    const brandCheckbox = filterDialog.getByLabel('Alpkit')
    const minimumInput = filterDialog.getByRole('group', { name: 'Weight (g)' }).getByLabel('Minimum')

    await brandCheckbox.focus()
    await expect.poll(async () => hasVisibleFocusOutline(brandCheckbox)).toBe(true)

    await minimumInput.focus()
    await expect.poll(async () => hasVisibleFocusOutline(minimumInput)).toBe(true)
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

  test('should map search and sorting to the API while preserving global route state', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      items: respondWithLoadMore
    })

    const propertyFilterEntries: QueryEntry[] = [
      ['number', 'weight:gte:80'],
      ['enum', 'fuel-type:canister'],
      ['boolean', 'piezo-ignition:true']
    ]

    const preservedEntries: QueryEntry[] = [
      ['brand', 'msr'],
      ['compare', 'second'],
      ['compare', 'first']
    ]

    const initialSearch = buildRouteSearch([
      ['q', 'old'],
      ['brand', 'msr'],
      ...propertyFilterEntries,
      ...preservedEntries.slice(1)
    ])

    await openGearLibrary(page, `/gear-library${initialSearch}`)

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const searchInput = searchRegion.getByLabel('Search gear')
    const categorySelect = searchRegion.getByLabel('Category')
    const sortSelect = searchRegion.getByLabel('Sort by')

    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const categorySearch = buildRouteSearch([
      ['q', 'old'],
      ['category', 'stoves'],
      ...preservedEntries
    ])

    await expectRouteSearch(page, categorySearch)
    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)

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
      booleanFilter: [],
      brandSlug: ['msr'],
      categorySlug: 'stoves',
      direction: 'asc',
      enumFilter: [],
      numberFilter: [],
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
    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)

    const itemsBeforeOrdering = tracker.items.length

    await sortSelect.selectOption('property:weight:desc')
    const orderedRequest = await waitForNextItemsRequest(tracker, itemsBeforeOrdering)

    const orderedRoute = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ['brand', 'msr'],
      ['sort', 'property:weight'],
      ['direction', 'desc'],
      ...preservedEntries.slice(1)
    ])

    await expectRouteSearch(page, orderedRoute)
    expect(tracker.items).toHaveLength(itemsBeforeOrdering + 1)

    expectQueryValues(orderedRequest, {
      direction: 'desc',
      page: '1',
      search: 'rocket',
      sort: 'property:weight'
    })

    await page.goBack()
    await expectRouteSearch(page, searchedRoute)
    await expect(sortSelect).toHaveValue('name:asc')

    await page.goForward()
    await expectRouteSearch(page, orderedRoute)
    await expect(sortSelect).toHaveValue('property:weight:desc')

    await page.reload()

    const loginUrl = new globalThis.URL(page.url())
    const redirectTarget = loginUrl.searchParams.get('redirectTo')

    expect(redirectTarget).not.toBeNull()

    const redirectUrl = new globalThis.URL(String(redirectTarget), loginUrl.origin)
    const expectedRedirectSearch = new globalThis.URLSearchParams(orderedRoute).toString()

    expect(loginUrl.pathname).toBe('/login')
    expect(redirectUrl.pathname).toBe('/gear-library')
    expect(redirectUrl.searchParams.toString()).toBe(expectedRedirectSearch)

    const requestsBeforeRestore = tracker.items.length

    await page.getByRole('button', { name: 'Guest' }).click()
    await waitForNextItemsRequest(tracker, requestsBeforeRestore)
    await expectRouteSearch(page, orderedRoute)
    await expect(searchInput).toHaveValue('rocket')
    await expect(categorySelect).toHaveValue('stoves')
    await expect(sortSelect).toHaveValue('property:weight:desc')
  })

  test('should reset ordering when the category changes', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = page.getByLabel('Category')
    const sortSelect = page.getByLabel('Sort by')
    const itemsBeforeBrandOrdering = tracker.items.length

    await sortSelect.selectOption('brand:desc')
    await waitForNextItemsRequest(tracker, itemsBeforeBrandOrdering)
    await expectRouteSearch(page, '?sort=brand&direction=desc')

    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)
    await expectRouteSearch(page, '?category=stoves')
    await expect(sortSelect).toHaveValue('name:asc')
    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)

    const itemsBeforePropertyOrdering = tracker.items.length

    await sortSelect.selectOption('property:weight:desc')
    await waitForNextItemsRequest(tracker, itemsBeforePropertyOrdering)
    await expectRouteSearch(page, '?category=stoves&sort=property%3Aweight&direction=desc')

    const itemsBeforeClearingCategory = tracker.items.length

    await categorySelect.selectOption('')
    const clearedCategoryRequest = await waitForNextItemsRequest(tracker, itemsBeforeClearingCategory)

    await expectRouteSearch(page, '')
    await expect(sortSelect).toHaveValue('name:asc')

    expect(clearedCategoryRequest.searchParams.get('categorySlug')).toBeNull()
    expect(clearedCategoryRequest.searchParams.get('sort')).toBe('name')
    expect(clearedCategoryRequest.searchParams.get('direction')).toBe('asc')

    await expect(page.getByText('Could not refresh results.')).toHaveCount(0)
  })

  test('should normalize unsupported metadata after definitive responses', async ({ context, page }) => {
    const categoriesGate = createDeferred()
    const tracker = await mockCatalogApi(context, {
      categories: () => {
        return {
          json: categoriesResponse,
          waitFor: categoriesGate.promise
        }
      },
      categoryDetail: () => serverErrorResponse
    })

    const route = '/gear-library?category=unknown-category&sort=property%3Aunknown-property&direction=desc'

    await openGearLibrary(page, route)

    const categorySelect = page.getByLabel('Category')
    const orderingSelect = page.getByLabel('Sort by')

    await expect(categorySelect).toBeDisabled()
    await expect(categorySelect.getByRole('option', { name: 'unknown-category' })).toHaveCount(0)
    await expect(orderingSelect).toBeEnabled()
    await expect(orderingSelect).toHaveValue('property:unknown-property:desc')
    await expect(orderingSelect.getByRole('option', {
      name: 'Current property sorting unavailable'
    })).toBeDisabled()
    await expect(orderingSelect.getByRole('option', { name: /unknown-property/u })).toHaveCount(0)

    const itemsBeforeNormalization = tracker.items.length

    categoriesGate.resolve()

    await expectRouteSearch(page, '')
    await waitForNextItemsRequest(tracker, itemsBeforeNormalization)
    await expect(categorySelect).toHaveValue('')
    await expect(orderingSelect).toHaveValue('name:asc')

    const propertyTracker = await mockCatalogApi(context)

    await openGearLibrary(page, '/gear-library?category=stoves&sort=property%3Amissing&direction=desc')
    await expectRouteSearch(page, '?category=stoves')
    await expect.poll(() => propertyTracker.categoryDetails.length).toBeGreaterThan(0)
    await expect(orderingSelect).toHaveValue('name:asc')
    await expect(orderingSelect.getByRole('option', { name: /missing/u })).toHaveCount(0)
  })

  test('should search and progressively reveal a long desktop brand list without requests', async ({ context, page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 900
    })

    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const filterDialog = await openFilterDialog(page)
    const brandSearchInput = filterDialog.getByRole('searchbox', { name: 'Search brands' })
    const brandGroup = filterDialog.getByRole('group', { name: /^Brands/u })
    const brandCheckboxes = brandGroup.getByRole('checkbox')
    const brandLabels = brandGroup.locator('label:has(input[type="checkbox"])')
    const initialBrandNames = [
      'Alpkit',
      'Big Agnes',
      'Black Diamond',
      'Coleman',
      'Exped',
      'Fjällräven',
      'GSI Outdoors',
      'Jetboil'
    ]

    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const initialBrandsRequestCount = tracker.brands.length
    const initialItemsRequestCount = tracker.items.length

    await test.step('show the collapsed alphabetical list', async () => {
      const showAllButton = brandGroup.getByRole('button', { name: 'Show all 12 brands' })

      await expect(filterDialog.getByText('0 filters selected', { exact: true })).toBeVisible()
      await expect(brandSearchInput).toBeVisible()
      await expect(brandCheckboxes).toHaveCount(8)
      await expect(brandLabels).toHaveText(initialBrandNames)
      await expect(brandGroup).toHaveCSS('border-bottom-style', 'none')
      await expect(brandGroup.getByLabel('Marmot')).toHaveCount(0)
      await expect(brandGroup.getByLabel('MSR')).toHaveCount(0)
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await expect(showAllButton).toHaveAttribute('aria-controls', /.+/u)
    })

    await test.step('keep the brand controls stable when the draft count changes', async () => {
      const alpkitCheckbox = brandGroup.getByLabel('Alpkit')
      const searchBoxBeforeSelection = await getElementBox(brandSearchInput)

      await alpkitCheckbox.check()
      await expect(filterDialog.getByText('1 filter selected', { exact: true })).toBeVisible()

      const searchBoxAfterSelection = await getElementBox(brandSearchInput)

      expect(searchBoxAfterSelection.y).toBeCloseTo(searchBoxBeforeSelection.y, 0)

      await alpkitCheckbox.uncheck()
      await expect(filterDialog.getByText('0 filters selected', { exact: true })).toBeVisible()

      const searchBoxAfterClearing = await getElementBox(brandSearchInput)

      expect(searchBoxAfterClearing.y).toBeCloseTo(searchBoxBeforeSelection.y, 0)
    })

    await test.step('search case-insensitively and clear without losing focus', async () => {
      await brandSearchInput.fill('mSr')
      await expect(brandCheckboxes).toHaveCount(1)
      await expect(brandGroup.getByLabel('MSR')).toBeVisible()
      await expect(brandGroup.getByRole('button', { name: 'Show all 12 brands' })).toHaveCount(0)

      await brandSearchInput.fill('missing brand')
      await expect(brandCheckboxes).toHaveCount(0)
      await expect(brandGroup.getByText('No matching brands.', { exact: true })).toBeVisible()

      const clearBrandSearchButton = brandGroup.getByRole('button', { name: 'Clear brand search' })

      await clearBrandSearchButton.focus()
      await page.keyboard.press('Enter')
      await expect(brandSearchInput).toHaveValue('')
      await expect(brandSearchInput).toBeFocused()
      await expect(brandCheckboxes).toHaveCount(8)
      await expect(brandGroup.getByText('No matching brands.', { exact: true })).toHaveCount(0)
    })

    await test.step('expand and collapse the full list', async () => {
      await brandGroup.getByRole('button', { name: 'Show all 12 brands' }).click()

      const showFewerButton = brandGroup.getByRole('button', { name: 'Show fewer' })

      await expect(brandCheckboxes).toHaveCount(12)
      await expect(showFewerButton).toHaveAttribute('aria-expanded', 'true')

      await showFewerButton.click()
      await expect(brandCheckboxes).toHaveCount(8)
      await expect(brandGroup.getByRole('button', { name: 'Show all 12 brands' }))
        .toHaveAttribute('aria-expanded', 'false')
    })

    await test.step('keep an additional selection ordered and focused when it is removed', async () => {
      await brandSearchInput.fill('MSR')

      const msrCheckbox = brandGroup.getByLabel('MSR')

      await msrCheckbox.check()
      await expect(brandGroup.getByText('1 selected', { exact: true })).toBeVisible()

      await brandGroup.getByRole('button', { name: 'Clear brand search' }).click()
      await expect(brandLabels).toHaveText([...initialBrandNames, 'MSR'])

      await msrCheckbox.focus()
      await page.keyboard.press('Space')

      await expect(msrCheckbox).not.toBeChecked()
      await expect(msrCheckbox).toBeFocused()
      await expect(brandCheckboxes).toHaveCount(12)
      await expect(brandGroup.getByText('1 selected', { exact: true })).toHaveCount(0)
      await expect(brandGroup.getByRole('button', { name: 'Show fewer' }))
        .toHaveAttribute('aria-expanded', 'true')
    })

    expect(tracker.brands).toHaveLength(initialBrandsRequestCount)
    expect(tracker.items).toHaveLength(initialItemsRequestCount)
    await expectRouteSearch(page, '')
  })

  test('should prevent selecting more brands than the API accepts', async ({ context, page }) => {
    await page.setViewportSize({
      height: 900,
      width: 1440
    })

    const tracker = await mockCatalogApi(context, {
      brands: () => {
        return { json: filterLimitBrandsResponse }
      }
    })

    await openGearLibrary(page)

    const filterDialog = await openFilterDialog(page)
    const brandGroup = filterDialog.getByRole('group', { name: /^Brands/u })
    const brandSearchInput = filterDialog.getByRole('searchbox', { name: 'Search brands' })
    const applyButton = filterDialog.getByRole('button', { name: 'Apply filters' })

    await brandGroup.getByRole('button', { name: 'Show all 21 brands' }).click()
    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const initialBrandsRequestCount = tracker.brands.length
    const initialItemsRequestCount = tracker.items.length

    for (let index = 1; index <= 19; index += 1) {
      const number = String(index).padStart(2, '0')

      // oxlint-disable-next-line no-await-in-loop -- Each reactive checkbox update must finish before the next one.
      await brandGroup.getByLabel(`Brand ${number}`).check()
    }

    await filterDialog.evaluate((element) => {
      element.scrollTop = 0
    })

    const searchBoxBeforeLimit = await getElementBox(brandSearchInput)

    await brandGroup.getByLabel('Brand 20').check()
    await filterDialog.evaluate((element) => {
      element.scrollTop = 0
    })

    const searchBoxAtLimit = await getElementBox(brandSearchInput)

    expect(searchBoxAtLimit.y).toBeCloseTo(searchBoxBeforeLimit.y, 0)
    await expect(filterDialog.getByText(
      'Limit of 20 brands reached. Deselect one to choose another.',
      { exact: true }
    )).toBeVisible()
    await expect(brandGroup.getByLabel('Brand 20')).toBeEnabled()
    await expect(brandGroup.getByLabel('Brand 21')).toBeDisabled()

    await page.waitForTimeout(100)
    expect(tracker.brands).toHaveLength(initialBrandsRequestCount)
    expect(tracker.items).toHaveLength(initialItemsRequestCount)
    await expectRouteSearch(page, '')

    await brandGroup.getByLabel('Brand 01').uncheck()
    await expect(brandGroup.getByLabel('Brand 21')).toBeEnabled()

    const searchBoxAfterLimit = await getElementBox(brandSearchInput)

    expect(searchBoxAfterLimit.y).toBeCloseTo(searchBoxBeforeLimit.y, 0)
    await brandGroup.getByLabel('Brand 21').check()

    const itemsBeforeApply = tracker.items.length

    await applyButton.click()

    const appliedRequest = await waitForNextItemsRequest(tracker, itemsBeforeApply)
    const expectedBrandSlugs = Array.from({ length: 20 }, (_value, index) => {
      const number = String(index + 2).padStart(2, '0')

      return `brand-${number}`
    })
    const expectedRouteEntries: QueryEntry[] = expectedBrandSlugs.map(
      (slug) => ['brand', slug]
    )

    expectQueryValues(appliedRequest, {
      brandSlug: expectedBrandSlugs
    })
    await expectRouteSearch(page, buildRouteSearch(expectedRouteEntries))
  })

  test('should enforce the combined property filter limit without blocking edits', async ({ context, page }) => {
    await page.setViewportSize({
      height: 900,
      width: 1440
    })

    const tracker = await mockCatalogApi(context, {
      categoryDetail: () => {
        return { json: filterLimitCategoryResponse }
      }
    })

    await openGearLibrary(page)

    const itemsBeforeCategory = tracker.items.length

    await page.getByLabel('Category').selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const filterDialog = await openFilterDialog(page)
    const activeNumberGroup = filterDialog.getByRole('group', { name: 'Active number' })
    const availableNumberGroup = filterDialog.getByRole('group', { name: 'Available number' })
    const enumGroup = filterDialog.getByRole('group', { name: 'Filter option' })
    const activeBooleanGroup = filterDialog.getByRole('group', { name: 'Active boolean' })
    const availableBooleanGroup = filterDialog.getByRole('group', { name: 'Available boolean' })

    await activeNumberGroup.getByLabel('Minimum').fill('1')
    await activeBooleanGroup.getByLabel('Yes').check()

    for (let index = 1; index <= 18; index += 1) {
      const number = String(index).padStart(2, '0')

      // oxlint-disable-next-line no-await-in-loop -- Each reactive checkbox update must finish before the next one.
      await enumGroup.getByLabel(`Option ${number}`).check()
    }

    await expect(filterDialog.getByText(
      'Limit of 20 property filters reached. Remove one to add another.',
      { exact: true }
    )).toBeVisible()
    await expect(enumGroup.getByLabel('Option 01')).toBeEnabled()
    await expect(enumGroup.getByLabel('Option 19')).toBeDisabled()
    await expect(activeNumberGroup.getByLabel('Minimum')).toBeEnabled()
    await expect(activeNumberGroup.getByLabel('Maximum')).toBeEnabled()
    await expect(availableNumberGroup.getByLabel('Minimum')).toBeDisabled()
    await expect(availableNumberGroup.getByLabel('Maximum')).toBeDisabled()
    await expect(activeBooleanGroup.getByLabel('Any')).toBeEnabled()
    await expect(activeBooleanGroup.getByLabel('No')).toBeEnabled()
    await expect(availableBooleanGroup.getByLabel('Any')).toBeEnabled()
    await expect(availableBooleanGroup.getByLabel('Yes')).toBeDisabled()
    await expect(availableBooleanGroup.getByLabel('No')).toBeDisabled()

    const itemsBeforeDraftChange = tracker.items.length

    await enumGroup.getByLabel('Option 01').uncheck()
    await expect(enumGroup.getByLabel('Option 19')).toBeEnabled()
    await expect(availableNumberGroup.getByLabel('Minimum')).toBeEnabled()
    await expect(availableBooleanGroup.getByLabel('Yes')).toBeEnabled()
    await enumGroup.getByLabel('Option 19').check()

    await page.waitForTimeout(100)
    expect(tracker.items).toHaveLength(itemsBeforeDraftChange)
    await expectRouteSearch(page, '?category=stoves')

    const itemsBeforeApply = tracker.items.length

    await filterDialog.getByRole('button', { name: 'Apply filters' }).click()

    const appliedRequest = await waitForNextItemsRequest(tracker, itemsBeforeApply)
    const expectedEnumFilters = Array.from({ length: 18 }, (_value, index) => {
      const number = String(index + 2).padStart(2, '0')

      return `filter-option:option-${number}`
    })
    const expectedRouteEntries: QueryEntry[] = [
      ['category', 'stoves'],
      ['number', 'active-number:1:'],
      ...expectedEnumFilters.map((filter): QueryEntry => ['enum', filter]),
      ['boolean', 'active-boolean:true']
    ]

    expectQueryValues(appliedRequest, {
      booleanFilter: ['active-boolean:true'],
      enumFilter: expectedEnumFilters,
      numberFilter: ['active-number:1:']
    })
    await expectRouteSearch(page, buildRouteSearch(expectedRouteEntries))
  })

  test('should apply, validate, label, and remove desktop filters through route history', async ({ context, page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 900
    })

    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = page.getByLabel('Category')
    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const filterDialog = await openFilterDialog(page)
    const weightGroup = filterDialog.getByRole('group', { name: 'Weight (g)' })
    const fuelGroup = filterDialog.getByRole('group', { name: 'Fuel type' })
    const piezoGroup = filterDialog.getByRole('group', { name: 'Piezo ignition' })
    const brandGroup = filterDialog.getByRole('group', { name: /^Brands/u })
    const brandSearchInput = filterDialog.getByRole('searchbox', { name: 'Search brands' })
    const showAllBrandsButton = filterDialog.getByRole('button', { name: 'Show all 12 brands' })
    const applyButton = filterDialog.getByRole('button', { name: 'Apply filters' })
    const closeButton = filterDialog.getByRole('button', { name: 'Close filters' })
    const minimumInput = weightGroup.getByLabel('Minimum')
    const maximumInput = weightGroup.getByLabel('Maximum')
    const rangeError = weightGroup.locator('[aria-live="polite"]')

    await expect(brandGroup).toHaveCSS('border-bottom-style', 'solid')
    await expect(piezoGroup).toHaveCSS('border-bottom-style', 'none')
    await expect(rangeError).toHaveCount(1)
    await expect(rangeError).toHaveAttribute('aria-atomic', 'true')
    await expect(rangeError).toBeEmpty()

    await showAllBrandsButton.click()
    await brandSearchInput.fill('msr')
    await filterDialog.getByLabel('MSR').check()
    await minimumInput.fill('100')
    await maximumInput.fill('80')
    await expect(rangeError).toHaveText('Minimum must not exceed maximum.')
    await expect(minimumInput).toHaveAttribute('aria-invalid', 'true')
    await expect(maximumInput).toHaveAttribute('aria-invalid', 'true')

    const rangeErrorId = await rangeError.getAttribute('id')
    const minimumDescribedBy = await minimumInput.getAttribute('aria-describedby')
    const maximumDescribedBy = await maximumInput.getAttribute('aria-describedby')

    expect(rangeErrorId).not.toBeNull()
    expect(minimumDescribedBy).toBe(rangeErrorId)
    expect(maximumDescribedBy).toBe(rangeErrorId)
    await expect(applyButton).toBeDisabled()

    await minimumInput.fill('80')
    await maximumInput.fill('100')
    await expect(rangeError).toBeEmpty()
    await expect(minimumInput).not.toHaveAttribute('aria-invalid', 'true')
    await expect(maximumInput).not.toHaveAttribute('aria-invalid', 'true')
    await expect(minimumInput).not.toHaveAttribute('aria-describedby', /.+/u)
    await expect(maximumInput).not.toHaveAttribute('aria-describedby', /.+/u)
    await fuelGroup.getByLabel('Canister').check()
    await piezoGroup.getByLabel('Yes').check()

    const itemsBeforeApply = tracker.items.length

    await applyButton.click()

    const appliedRequest = await waitForNextItemsRequest(tracker, itemsBeforeApply)
    const appliedSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['brand', 'msr'],
      ['number', 'weight:80:100'],
      ['enum', 'fuel-type:canister'],
      ['boolean', 'piezo-ignition:true']
    ])

    await expectRouteSearch(page, appliedSearch)
    await page.waitForTimeout(100)
    expect(tracker.items).toHaveLength(itemsBeforeApply + 1)
    await expect(filterDialog).not.toBeVisible()

    expectQueryValues(appliedRequest, {
      booleanFilter: ['piezo-ignition:true'],
      brandSlug: ['msr'],
      enumFilter: ['fuel-type:canister'],
      numberFilter: ['weight:80:100'],
      page: '1'
    })

    const appliedFilters = page.getByRole('list', { name: 'Applied filters' })

    await expect(appliedFilters.getByRole('button')).toHaveCount(4)
    await expect(appliedFilters.getByText('Brand: MSR', { exact: true })).toBeVisible()
    await expect(appliedFilters.getByText('Weight: 80–100 g', { exact: true })).toBeVisible()
    await expect(appliedFilters.getByText('Fuel type: Canister', { exact: true })).toBeVisible()
    await expect(appliedFilters.getByText('Piezo ignition: Yes', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Filters 4' }).click()
    await expect(brandSearchInput).toHaveValue('')
    await expect(filterDialog.getByLabel('MSR')).toBeChecked()
    await expect(showAllBrandsButton).toHaveAttribute('aria-expanded', 'false')

    await filterDialog.getByLabel('Alpkit').check()
    await expect(filterDialog.getByRole('button', { name: 'Reset changes' })).toHaveCount(0)
    await closeButton.click()
    await expectRouteSearch(page, appliedSearch)

    const itemsBeforeRemove = tracker.items.length

    await appliedFilters.getByRole('button', { name: 'Remove Fuel type: Canister filter' }).click()
    await waitForNextItemsRequest(tracker, itemsBeforeRemove)

    const removedSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['brand', 'msr'],
      ['number', 'weight:80:100'],
      ['boolean', 'piezo-ignition:true']
    ])

    await expectRouteSearch(page, removedSearch)
    await expect(appliedFilters.getByRole('button')).toHaveCount(3)
    await expect(appliedFilters.getByRole('button', {
      name: 'Remove Piezo ignition: Yes filter'
    })).toBeFocused()

    await page.getByRole('button', { name: 'Filters 3' }).click()
    await expect(brandSearchInput).toHaveValue('')
    await expect(filterDialog.getByLabel('MSR')).toBeChecked()
    await expect(fuelGroup.getByLabel('Canister')).not.toBeChecked()
    await closeButton.click()

    await page.goBack()
    await expectRouteSearch(page, appliedSearch)
    await expect(appliedFilters.getByRole('button')).toHaveCount(4)

    await page.getByRole('button', { name: 'Filters 4' }).click()
    await expect(fuelGroup.getByLabel('Canister')).toBeChecked()
    await closeButton.click()

    const itemsBeforeRemoveLast = tracker.items.length

    await appliedFilters.getByRole('button', {
      name: 'Remove Piezo ignition: Yes filter'
    }).click()
    await waitForNextItemsRequest(tracker, itemsBeforeRemoveLast)
    await expect(appliedFilters.getByRole('button')).toHaveCount(3)
    await expect(appliedFilters.getByRole('button', {
      name: 'Remove Fuel type: Canister filter'
    })).toBeFocused()

    const itemsBeforeClearAll = tracker.items.length

    await page.getByRole('button', { name: 'Clear all' }).click()
    await waitForNextItemsRequest(tracker, itemsBeforeClearAll)
    await page.waitForTimeout(100)
    expect(tracker.items).toHaveLength(itemsBeforeClearAll + 1)
    await expectRouteSearch(page, '?category=stoves')
    await expect(appliedFilters).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Filters' })).toBeFocused()
  })

  test('should keep mobile filter drafts isolated and apply cleared filters immediately', async ({ context, page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    })

    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = page.getByLabel('Category')
    const itemsBeforeCategory = tracker.items.length

    await categorySelect.selectOption('stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const filtersButton = page.getByRole('button', { name: 'Filters' })

    await filtersButton.click()

    const filterDialog = page.getByRole('dialog', { name: 'Filters' })
    const brandSearchInput = filterDialog.getByRole('searchbox', { name: 'Search brands' })
    const msrCheckbox = filterDialog.getByLabel('MSR')
    const showAllButton = filterDialog.getByRole('button', { name: 'Show all 12 brands' })
    const filterTitle = filterDialog.getByRole('heading', { name: 'Filters' })
    const applyButton = filterDialog.getByRole('button', { name: 'Apply filters' })
    const closeButton = filterDialog.getByRole('button', { name: 'Close filters' })

    await expect(filterTitle).toBeFocused()
    await expect(closeButton).toBeVisible()
    await expect(applyButton).toBeDisabled()
    await expect(filterDialog.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
    await waitForBlockEndAnchoring(filterDialog, 844)

    const filterDialogBox = await getElementBox(filterDialog)
    const titleBoxBeforeScroll = await getElementBox(filterTitle)
    const pageScrollBeforeBottomSheetScroll = await page.evaluate(() => globalThis.scrollY)

    expect(filterDialogBox.x).toBeCloseTo(0)
    expect(filterDialogBox.width).toBeCloseTo(390)
    expect(filterDialogBox.height).toBeCloseTo(844 * 0.9, 0)
    expect(filterDialogBox.y + filterDialogBox.height).toBeCloseTo(844, 0)

    await brandSearchInput.fill('msr')

    const narrowedFilterDialogBox = await getElementBox(filterDialog)

    expect(narrowedFilterDialogBox.height).toBeCloseTo(filterDialogBox.height, 0)

    await filterDialog.getByRole('button', { name: 'Clear brand search' }).click()

    const restoredFilterDialogBox = await getElementBox(filterDialog)

    expect(restoredFilterDialogBox.height).toBeCloseTo(filterDialogBox.height, 0)

    await filterDialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    const titleBoxAfterScroll = await getElementBox(filterTitle)
    const applyButtonBox = await getElementBox(applyButton)
    const pageScrollAfterBottomSheetScroll = await page.evaluate(() => globalThis.scrollY)

    expect(titleBoxAfterScroll.y).toBeCloseTo(titleBoxBeforeScroll.y, 0)
    expect(applyButtonBox.y + applyButtonBox.height).toBeLessThanOrEqual(844)
    expect(pageScrollAfterBottomSheetScroll).toBe(pageScrollBeforeBottomSheetScroll)

    await test.step('discard a cancelled draft and reset the brand view', async () => {
      await expect(filterDialog).toBeVisible()
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')

      await brandSearchInput.fill('msr')
      await msrCheckbox.check()
      await expect(filterDialog.getByText('1 selected', { exact: true })).toBeVisible()

      await closeButton.click()
      await expect(filterDialog).not.toBeVisible()
      await expectRouteSearch(page, '?category=stoves')

      await filtersButton.click()
      await expect(brandSearchInput).toHaveValue('')
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await expect(msrCheckbox).toHaveCount(0)
    })

    await test.step('apply a searched brand and reset the next dialog view', async () => {
      await brandSearchInput.fill('MSR')
      await msrCheckbox.check()

      const itemsBeforeApply = tracker.items.length

      await filterDialog.getByRole('button', { name: 'Apply filters' }).click()
      await waitForNextItemsRequest(tracker, itemsBeforeApply)
      await page.waitForTimeout(100)
      expect(tracker.items).toHaveLength(itemsBeforeApply + 1)
      await expect(filterDialog).not.toBeVisible()
      await expectRouteSearch(page, '?category=stoves&brand=msr')

      const appliedFiltersButton = page.getByRole('button', { name: 'Filters 1' })

      await expect(appliedFiltersButton).toBeVisible()
      await appliedFiltersButton.click()
      await expect(brandSearchInput).toHaveValue('')
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await expect(msrCheckbox).toBeChecked()
    })

    await test.step('discard an escaped draft and reset the expanded view', async () => {
      await msrCheckbox.uncheck()
      await expect(filterDialog.getByRole('button', { name: 'Show fewer' }))
        .toHaveAttribute('aria-expanded', 'true')

      await brandSearchInput.fill('nemo')
      await closeButton.focus()
      await page.keyboard.press('Escape')
      await expect(filterDialog).not.toBeVisible()
      await expectRouteSearch(page, '?category=stoves&brand=msr')

      await page.getByRole('button', { name: 'Filters 1' }).click()
      await expect(brandSearchInput).toHaveValue('')
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await expect(msrCheckbox).toBeChecked()
    })

    await test.step('discard a backdrop-closed draft and reset the search', async () => {
      await brandSearchInput.fill('nemo')
      await filterDialog.getByLabel('NEMO').check()
      await page.mouse.click(1, 1)
      await expect(filterDialog).not.toBeVisible()
      await expectRouteSearch(page, '?category=stoves&brand=msr')

      await page.getByRole('button', { name: 'Filters 1' }).click()
      await expect(brandSearchInput).toHaveValue('')
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await expect(msrCheckbox).toBeChecked()
      await expect(filterDialog.getByLabel('NEMO')).toHaveCount(0)
    })

    await test.step('clear and apply the empty state in one action', async () => {
      await brandSearchInput.fill('msr')

      const itemsBeforeClear = tracker.items.length

      await filterDialog.getByRole('button', { name: 'Clear filters' }).click()
      await waitForNextItemsRequest(tracker, itemsBeforeClear)
      await page.waitForTimeout(100)
      expect(tracker.items).toHaveLength(itemsBeforeClear + 1)
      await expectRouteSearch(page, '?category=stoves')
      await expect(filterDialog).not.toBeVisible()

      await page.goBack()
      await expectRouteSearch(page, '?category=stoves&brand=msr')

      await page.getByRole('button', { name: 'Filters 1' }).click()
      await expect(brandSearchInput).toHaveValue('')
      await expect(showAllButton).toHaveAttribute('aria-expanded', 'false')
      await brandSearchInput.fill('msr')
      await expect(msrCheckbox).toBeChecked()
    })
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
    await expect(page.getByLabel('Sort by').getByRole('option', { name: 'R-value: Low to high' }))
      .toHaveCount(1)
  })

  test('should append ten-item batches without exposing browsing depth in the URL', async ({ context, page }) => {
    const secondPageGate = createDeferred()
    const tracker = await mockCatalogApi(context, {
      items: createGatedLoadMoreResponder('2', secondPageGate)
    })

    await openGearLibrary(page)
    await expect.poll(() => tracker.items.length).toBeGreaterThan(0)

    const results = page.getByTestId('gear-library-results-body')
    const loadMoreButton = page.getByRole('button', { name: 'Load more' })
    const liveRegion = page.getByTestId('gear-library-load-more-status')
    const initialRequest = getLastRequest(tracker.items)

    expectQueryValues(initialRequest, {
      limit: '10',
      page: '1'
    })
    await expect(results.getByRole('listitem')).toHaveCount(10)
    await expect(loadMoreButton).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)

    const requestsBeforeSecondPage = tracker.items.length

    await loadMoreButton.click()

    const secondPageRequest = await waitForNextItemsRequest(tracker, requestsBeforeSecondPage)

    expectQueryValues(secondPageRequest, {
      limit: '10',
      page: '2'
    })
    await expectRouteSearch(page, '')

    secondPageGate.resolve()

    await expect(results.getByRole('listitem')).toHaveCount(20)
    await expectRouteSearch(page, '')
    await expect(liveRegion).toHaveText('10 more items loaded')

    const requestsBeforeThirdPage = tracker.items.length

    await loadMoreButton.click()

    const thirdPageRequest = await waitForNextItemsRequest(tracker, requestsBeforeThirdPage)

    expectQueryValues(thirdPageRequest, {
      limit: '10',
      page: '3'
    })
    await expect(results.getByRole('listitem')).toHaveCount(23)
    await expectRouteSearch(page, '')
    await expect(liveRegion).toHaveText('3 more items loaded')
    await expect(loadMoreButton).toHaveCount(0)
  })

  test('should ignore removed batch URL state and reset to ten items in a fresh document', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      items: respondWithLoadMore
    })

    await openGearLibrary(page, '/gear-library?batch=99')

    const results = page.getByTestId('gear-library-results-body')
    const loadMoreButton = page.getByRole('button', { name: 'Load more' })

    await expectRouteSearch(page, '')
    await expect(results.getByRole('listitem')).toHaveCount(10)
    expect(tracker.items.map((request) => request.searchParams.get('page'))).toStrictEqual(['1'])

    await loadMoreButton.click()
    await expect(results.getByRole('listitem')).toHaveCount(20)
    await loadMoreButton.click()
    await expect(results.getByRole('listitem')).toHaveCount(23)
    await expectRouteSearch(page, '')

    const requestsBeforeFreshDocument = tracker.items.length

    await openGearLibrary(page)
    await expectRouteSearch(page, '')
    await expect(results.getByRole('listitem')).toHaveCount(10)
    expect(tracker.items.slice(requestsBeforeFreshDocument).every((request) => (
      request.searchParams.get('page') === '1'
    ))).toBe(true)
  })

  test('should keep existing rows when Load more fails and append them after Retry', async ({ context, page }) => {
    const failureState: LoadMoreFailureState = {
      shouldFail: true
    }
    const tracker = await mockCatalogApi(context, {
      items: createFailingLoadMoreResponder('2', failureState)
    })

    await openGearLibrary(page)

    const results = page.getByTestId('gear-library-results-body')

    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByText('Could not load more results.')).toBeVisible()
    await expect(results.getByRole('listitem')).toHaveCount(10)
    await expectRouteSearch(page, '')

    failureState.shouldFail = false
    const requestsBeforeRetry = tracker.items.length

    await page.getByRole('button', { name: 'Retry' }).click()

    const retryRequest = await waitForNextItemsRequest(tracker, requestsBeforeRetry)

    expect(retryRequest.searchParams.get('page')).toBe('2')
    await expect(results.getByRole('listitem')).toHaveCount(20)
    await expectRouteSearch(page, '')
    await expect(page.getByTestId('gear-library-load-more-status')).toHaveText('10 more items loaded')
  })

  test('should Retry the first missing later page without exposing browsing depth', async ({ context, page }) => {
    const failureState: LoadMoreFailureState = {
      shouldFail: true
    }
    const tracker = await mockCatalogApi(context, {
      items: createFailingLoadMoreResponder('3', failureState)
    })

    await openGearLibrary(page)

    const results = page.getByTestId('gear-library-results-body')
    const liveRegion = page.getByTestId('gear-library-load-more-status')

    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(results.getByRole('listitem')).toHaveCount(20)
    await expect(liveRegion).toHaveText('10 more items loaded')
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByText('Could not load more results.')).toBeVisible()
    await expect(results.getByRole('listitem')).toHaveCount(20)
    await expectRouteSearch(page, '')
    await expect(liveRegion).toHaveText('')

    failureState.shouldFail = false
    const requestsBeforeRetry = tracker.items.length

    await page.getByRole('button', { name: 'Retry' }).click()

    const retryRequest = await waitForNextItemsRequest(tracker, requestsBeforeRetry)

    expect(retryRequest.searchParams.get('page')).toBe('3')
    await expect(results.getByRole('listitem')).toHaveCount(23)
    await expectRouteSearch(page, '')
    await expect(liveRegion).toHaveText('3 more items loaded')
  })

  test('should abort a stale Load more request when the search query changes', async ({ context, page }) => {
    const secondPageGate = createDeferred()
    const tracker = await mockCatalogApi(context, {
      items: createStaleLoadMoreResponder(secondPageGate)
    })

    await openGearLibrary(page)

    const requestsBeforeLoadMore = tracker.items.length

    await page.getByRole('button', { name: 'Load more' }).click()
    await waitForNextItemsRequest(tracker, requestsBeforeLoadMore)

    const staleRequestFailure = page.waitForEvent('requestfailed', isSecondPageItemsRequest)

    await page.getByLabel('Search gear').fill('whisper')

    const failedRequest = await staleRequestFailure

    expect(failedRequest.failure()?.errorText).toContain('ERR_ABORTED')

    secondPageGate.resolve()

    await expectRouteSearch(page, '?q=whisper')
    await expect(page.getByRole('link', { name: 'WhisperLite Universal' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Catalog item 11' })).toHaveCount(0)
  })

  test('should abort a pending Load more request when opening an item', async ({ context, page }) => {
    const secondPageGate = createDeferred()
    const detailItem = getRequiredLoadMoreItem(4)
    const tracker = await mockCatalogApi(context, {
      items: createGatedLoadMoreResponder('2', secondPageGate)
    })

    await mockItemDetailApi(context, detailItem)
    await openGearLibrary(page)

    const requestsBeforeLoadMore = tracker.items.length

    await page.getByRole('button', { name: 'Load more' }).click()
    await waitForNextItemsRequest(tracker, requestsBeforeLoadMore)

    const staleRequestFailure = page.waitForEvent('requestfailed', isSecondPageItemsRequest)

    const detailNavigation = page.waitForURL((url) => url.pathname === `/gear-library/${detailItem.id}`)

    await page.getByRole('link', { name: detailItem.name }).click()

    const failedRequest = await staleRequestFailure

    expect(failedRequest.failure()?.errorText).toContain('ERR_ABORTED')

    secondPageGate.resolve()
    await detailNavigation
    await expect(page.getByRole('link', { name: 'Back to gear library' })).toBeVisible()

    const detailUrl = new globalThis.URL(page.url())

    expect(detailUrl.pathname).toBe(`/gear-library/${detailItem.id}`)
    expect(detailUrl.searchParams.get('batch')).toBeNull()
    expect(detailUrl.searchParams.get('returnTo')).toBe('/gear-library')
  })

  test('should restore loaded rows and scroll on Back without sharing browsing depth', async ({ context, page }) => {
    const detailItem = getRequiredLoadMoreItem(17)
    const catalogPath = '/gear-library?q=catalog'

    await page.setViewportSize({
      height: 600,
      width: 1280
    })
    await mockCatalogApi(context, {
      items: respondWithLoadMore
    })
    await mockItemDetailApi(context, detailItem)
    await openGearLibrary(page, catalogPath)

    const results = page.getByTestId('gear-library-results-body')

    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(results.getByRole('listitem')).toHaveCount(20)

    const detailLink = page.getByRole('link', { name: detailItem.name })

    await detailLink.evaluate((element) => {
      element.scrollIntoView({ block: 'center' })
    })

    const savedScrollTop = await page.evaluate(() => globalThis.scrollY)
    const detailHref = await getRequiredHref(detailLink)

    expect(savedScrollTop).toBeGreaterThan(0)

    const pageUrl = page.url()
    const detailUrl = new globalThis.URL(detailHref, pageUrl)

    expect(detailUrl.pathname).toBe(`/gear-library/${detailItem.id}`)
    expect(detailUrl.searchParams.get('returnTo')).toBe(catalogPath)

    await detailLink.click()

    const backLink = page.getByRole('link', { name: 'Back to gear library' })

    await expect(backLink).toHaveAttribute('href', catalogPath)

    await backLink.click()
    await expectRouteSearch(page, '?q=catalog')
    await expect(results.getByRole('listitem')).toHaveCount(20)

    await expect.poll(async () => getScrollDistance(page, savedScrollTop)).toBeLessThanOrEqual(2)

    const hasUnconsumedBrowsingState = await hasHistoryStateKey(page, 'gearLibraryBrowsing')

    expect(hasUnconsumedBrowsingState).toBe(false)

    const sharedPage = await context.newPage()

    await openGearLibrary(sharedPage, catalogPath)
    await expectRouteSearch(sharedPage, '?q=catalog')
    await expect(sharedPage.getByTestId('gear-library-results-body').getByRole('listitem')).toHaveCount(10)
    await expect.poll(async () => sharedPage.evaluate(() => globalThis.scrollY)).toBe(0)

    await sharedPage.close()
  })

  test('should Retry the first missing Back restoration page before restoring scroll', async ({ context, page }) => {
    const detailItem = getRequiredLoadMoreItem(22)
    const failureState: LoadMoreFailureState = {
      shouldFail: false
    }
    const tracker = await mockCatalogApi(context, {
      items: createFailingLoadMoreResponder('2', failureState)
    })

    await page.setViewportSize({
      height: 600,
      width: 1280
    })
    await mockItemDetailApi(context, detailItem)
    await openGearLibrary(page)

    const results = page.getByTestId('gear-library-results-body')
    const loadMoreButton = page.getByRole('button', { name: 'Load more' })

    await loadMoreButton.click()
    await expect(results.getByRole('listitem')).toHaveCount(20)
    await loadMoreButton.click()
    await expect(results.getByRole('listitem')).toHaveCount(23)

    const detailLink = page.getByRole('link', { name: detailItem.name })

    await detailLink.evaluate((element) => {
      element.scrollIntoView({ block: 'center' })
    })

    const savedScrollTop = await page.evaluate(() => globalThis.scrollY)

    expect(savedScrollTop).toBeGreaterThan(0)

    await detailLink.click()

    const backLink = page.getByRole('link', { name: 'Back to gear library' })

    await expect(backLink).toBeVisible()
    await clearGearLibraryItemsSnapshot(page)

    failureState.shouldFail = true
    const requestsBeforeBack = tracker.items.length

    await backLink.click()
    await expect(page.getByText('Could not load more results.')).toBeVisible()
    await expect(results.getByRole('listitem')).toHaveCount(10)
    await expect.poll(() => tracker.items.slice(requestsBeforeBack).map((request) => (
      request.searchParams.get('page')
    ))).toContain('2')
    await expect.poll(async () => getScrollDistance(page, savedScrollTop)).toBeGreaterThan(2)

    failureState.shouldFail = false
    const requestsBeforeRetry = tracker.items.length

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(results.getByRole('listitem')).toHaveCount(23)
    await expect.poll(() => tracker.items.slice(requestsBeforeRetry).map((request) => (
      request.searchParams.get('page')
    ))).toStrictEqual(['2', '3'])
    await expect.poll(async () => getScrollDistance(page, savedScrollTop)).toBeLessThanOrEqual(2)

    const hasUnconsumedBrowsingState = await hasHistoryStateKey(page, 'gearLibraryBrowsing')

    expect(hasUnconsumedBrowsingState).toBe(false)
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
    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)
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
    const resultsSkeletonRow = page.getByTestId('gear-library-results-skeleton-row')

    await expect(initialProgress).toBeVisible()
    await expect(resultsSkeleton).toBeVisible()
    await expect(resultsSkeleton).toHaveAttribute('data-visible', 'true')

    const initialProgressBox = await getElementBox(initialProgress)
    const resultsSkeletonBox = await getElementBox(resultsSkeleton)
    const resultsSkeletonRowBox = await getElementBox(resultsSkeletonRow)

    expect(initialProgressBox.height).toBeLessThanOrEqual(2)
    expect(resultsSkeletonBox.height).toBeCloseTo(resultsSkeletonRowBox.height, 0)

    initialRequestGate.resolve()

    await loginClickPromise

    await expect(page.getByRole('heading', { name: 'Gear library unavailable.' })).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toHaveCount(0)

    const itemsBeforeRetry = tracker.items.length

    itemsState.response = { json: firstPageResponse }

    await page.getByRole('button', { name: 'Retry' }).click()
    await waitForNextItemsRequest(tracker, itemsBeforeRetry)

    const resultsBody = page.getByTestId('gear-library-results-body')
    const firstResultRow = resultsBody.getByRole('list').getByRole('listitem').first()

    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()

    const firstResultRowBox = await getElementBox(firstResultRow)
    const verticalShift = Math.abs(firstResultRowBox.y - resultsSkeletonRowBox.y)
    const heightDifference = Math.abs(firstResultRowBox.height - resultsSkeletonRowBox.height)

    expect(verticalShift).toBeLessThanOrEqual(4)
    expect(heightDifference).toBeLessThanOrEqual(1)
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

  test('should keep cached category metadata usable when revalidation fails', async ({ context, page }) => {
    const categoriesState: MutableResponseState = {
      response: { json: categoriesResponse }
    }

    const categoryDetailState: MutableResponseState = {
      response: { json: stovesCategoryResponse }
    }

    await mockCatalogApi(context, {
      categories: respondFromState(categoriesState),
      categoryDetail: respondFromState(categoryDetailState)
    })

    await openGearLibrary(page, '/gear-library?category=stoves')

    const initialSortSelect = page.getByLabel('Sort by')

    await expect(initialSortSelect.getByRole('option', { name: 'Weight (g): Low to high' }))
      .toHaveCount(1)

    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Home' }).click()
    await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe('/')

    categoriesState.response = serverErrorResponse
    categoryDetailState.response = serverErrorResponse

    const categoriesFailurePromise = page.waitForResponse('**/api/equipment/categories')

    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Gear library' }).click()
    await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe('/gear-library')

    const categoriesFailure = await categoriesFailurePromise

    expect(categoriesFailure.status()).toBe(500)

    const categorySelect = page.getByLabel('Category')
    const categoriesAlert = page.getByRole('alert').filter({ hasText: 'Categories unavailable.' })

    await expect(categorySelect).toBeEnabled()
    await expect(categorySelect.getByRole('option', { name: 'Stoves' })).toHaveCount(1)
    await expect(categoriesAlert).toHaveCount(0)

    const categoryDetailFailurePromise = page.waitForResponse(
      '**/api/equipment/categories/by-slug/stoves'
    )

    await categorySelect.selectOption('stoves')

    const categoryDetailFailure = await categoryDetailFailurePromise

    expect(categoryDetailFailure.status()).toBe(500)

    const sortSelect = page.getByLabel('Sort by')
    const categoryDetailAlert = page.getByRole('alert').filter({
      hasText: 'Category filters and property sorting unavailable.'
    })

    await expect(sortSelect).toBeEnabled()
    await expect(sortSelect.getByRole('option', { name: 'Weight (g): Low to high' })).toHaveCount(1)
    await expect(categoryDetailAlert).toHaveCount(0)

    const filterDialog = await openFilterDialog(page)

    await expect(filterDialog.getByRole('group', { name: 'Weight (g)' })).toBeVisible()
    await expect(filterDialog.getByRole('alert').filter({
      hasText: 'Category filters unavailable.'
    })).toHaveCount(0)
  })

  test('should retry brands after their initial request fails', async ({ context, page }) => {
    const brandsState: MutableResponseState = {
      response: serverErrorResponse
    }

    const tracker = await mockCatalogApi(context, {
      brands: respondFromState(brandsState)
    })

    await openGearLibrary(page)

    const filterDialog = await openFilterDialog(page)
    const brandsAlert = filterDialog.getByRole('alert').filter({ hasText: 'Brands unavailable.' })

    await expect(brandsAlert).toBeVisible()

    const brandsBeforeRetry = tracker.brands.length

    brandsState.response = { json: brandsResponse }

    const brandsRetryPromise = page.waitForResponse('**/api/equipment/brands')

    await brandsAlert.getByRole('button', { name: 'Retry' }).click()

    const brandsRetryResponse = await brandsRetryPromise

    expect(brandsRetryResponse.status()).toBe(200)
    await expect.poll(() => tracker.brands.length).toBeGreaterThan(brandsBeforeRetry)
    await expect(brandsAlert).toHaveCount(0)
    await expect(filterDialog.getByLabel('Alpkit')).toBeVisible()
    await expect(filterDialog.getByRole('button', { name: 'Show all 12 brands' })).toBeVisible()
  })

  test('should let users clear a selected category while category metadata is unavailable', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      categories: () => serverErrorResponse
    })

    await openGearLibrary(page, '/gear-library?category=stoves')

    const categorySelect = page.getByLabel('Category')
    const currentCategoryOption = categorySelect.getByRole('option', {
      name: 'Stoves (current selection)'
    })

    await expect(page.getByRole('alert').filter({ hasText: 'Categories unavailable.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(categorySelect).toBeEnabled()
    await expect(categorySelect).toHaveValue('stoves')
    await expect(currentCategoryOption).toBeDisabled()

    const itemsBeforeClear = tracker.items.length

    await categorySelect.selectOption('')

    const clearedRequest = await waitForNextItemsRequest(tracker, itemsBeforeClear)

    await expectRouteSearch(page, '')
    await expect(categorySelect).toBeDisabled()
    expect(clearedRequest.searchParams.get('categorySlug')).toBeNull()
  })

  test('should keep base ordering usable while property sorting metadata is unavailable', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context, {
      categoryDetail: () => serverErrorResponse
    })

    const route = '/gear-library?category=stoves&sort=property%3Aweight&direction=desc'

    await openGearLibrary(page, route)

    const orderingSelect = page.getByLabel('Sort by')
    const unavailableOrderingOption = orderingSelect.getByRole('option', {
      name: 'Current property sorting unavailable'
    })

    await expect(page.getByRole('alert').filter({
      hasText: 'Category filters and property sorting unavailable.'
    })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(orderingSelect).toBeEnabled()
    await expect(orderingSelect).toHaveValue('property:weight:desc')
    await expect(unavailableOrderingOption).toBeDisabled()

    const itemsBeforeOrdering = tracker.items.length

    await orderingSelect.selectOption('brand:desc')

    const orderedRequest = await waitForNextItemsRequest(tracker, itemsBeforeOrdering)

    await expectRouteSearch(page, '?category=stoves&sort=brand&direction=desc')
    expectQueryValues(orderedRequest, {
      categorySlug: 'stoves',
      direction: 'desc',
      sort: 'brand'
    })
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

    const propertySortAlert = page.getByRole('alert')
      .filter({ hasText: 'Category filters and property sorting unavailable.' })

    await expect(propertySortAlert).toBeVisible()
    await expect(itemLink).toBeVisible()

    const categoryDetailsBeforeRetry = tracker.categoryDetails.length

    categoryDetailState.response = { json: stovesCategoryResponse }

    await propertySortAlert.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => tracker.categoryDetails.length).toBeGreaterThan(categoryDetailsBeforeRetry)

    await expect(page.getByLabel('Sort by').getByRole('option', { name: 'Weight (g): Low to high' }))
      .toHaveCount(1)
  })
})
