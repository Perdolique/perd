import type { BrowserContext, Locator, Page, Request, Route } from '@playwright/test'

import type {
  GearLibraryEntityDetail,
  GearLibraryItemsResponse,
  GearLibraryListItem,
  ItemDetailResponse
} from '../../../app/types/equipment'

import type { CategoryDetailResponse } from '../../../server/api/equipment/categories/by-slug/[slug].get'
import { expect } from './global.fixtures.ts'

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
  addMyGear?: (request: Request) => ApiMockResponse | Promise<ApiMockResponse>;
  brands?: CatalogResponder;
  categories?: CatalogResponder;
  categoryDetail?: CatalogResponder;
  itemDetails?: CatalogResponder;
  items?: CatalogResponder;
  myGear?: (request: Request) => ApiMockResponse | Promise<ApiMockResponse>;
}

interface CatalogRequestTracker {
  brands: ParsedUrl[];
  categories: ParsedUrl[];
  categoryDetails: ParsedUrl[];
  itemDetails: ParsedUrl[];
  items: ParsedUrl[];
  myGear: Request[];
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

const fixtureItems = [
  stoveItem,
  sleepingPadItem,
  secondPageItem,
  ...scrollableItemsResponse.items,
  ...loadMoreItems
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

function createItemDetailResponse(item: GearLibraryListItem): ItemDetailResponse {
  return {
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
      id: item.category.slug === 'stoves' ? 2 : 1,
      name: item.category.name,
      slug: item.category.slug
    }
  }
}

function respondWithItemDetail(request: CatalogRequest): ApiMockResponse {
  const itemId = request.url.pathname.split('/').at(-1)
  const item = fixtureItems.find((fixtureItem) => fixtureItem.id === itemId)

  if (item === undefined) {
    return {
      status: 404,
      json: { statusCode: 404 }
    }
  }

  return { json: createItemDetailResponse(item) }
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
    itemDetails: [],
    items: [],
    myGear: []
  }

  await context.route((url) => url.pathname === '/api/user/gear', async (route) => {
    const request = route.request()
    const isCreateRequest = request.method() === 'POST'

    tracker.myGear.push(request)

    const responder = isCreateRequest ? config.addMyGear : config.myGear
    const fallback = isCreateRequest
      ? {
          status: 201,

          json: {
            createdAt: '2026-07-23T00:00:00.000Z',
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab',
            item: createItemDetailResponse(stoveItem)
          }
        }
      : { json: [] }
    const response = responder === undefined ? fallback : await responder(request)

    await fulfillMockResponse(route, response)
  })

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

  await context.route((url) => /^\/api\/equipment\/items\/[^/]+$/u.test(url.pathname), async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())

    tracker.itemDetails.push(requestUrl)

    const request = {
      count: tracker.itemDetails.length,
      url: requestUrl
    }

    const fallback = respondWithItemDetail(request)
    const response = await resolveMockResponse(config.itemDetails, request, fallback)

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
  const itemDetailResponse = createItemDetailResponse(item)

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
    if (
      typeof nuxtState !== 'object'
      || nuxtState === null
      || typeof gearLibraryCache !== 'object'
      || gearLibraryCache === null
    ) {
      throw new Error('Expected the Nuxt gear library cache state')
    }

    const cacheWithoutItems = Object.fromEntries(
      Object.entries(gearLibraryCache).filter(([key]) => key !== 'items')
    )

    Object.assign(nuxtState, {
      '$sgear-library-cache': cacheWithoutItems
    })
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

function getGearLibrarySelect(root: Locator | Page, label: 'Category' | 'Sort by') {
  const accessibleName = label === 'Category' ? /^Category/u : /^Sort by/u

  return root.getByRole('combobox', { name: accessibleName })
}

function getPerdSelectOptions(select: Locator) {
  return select.locator('..').locator('[role="option"]')
}

function getPerdSelectOption(select: Locator, value: string) {
  return select.locator('..').locator(`[role="option"][data-value="${value}"]`)
}

async function selectPerdOption(select: Locator, value: string) {
  const option = getPerdSelectOption(select, value)

  await select.click()
  await option.click()
}

async function expectPerdSelectValue(select: Locator, value: string) {
  await expect(select).toHaveAttribute('data-value', value)
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

export {
  type MutableResponseState,
  type LoadMoreFailureState,
  type QueryEntry,
  firstPageResponse,
  sleepingPadItem,
  stoveItem,
  secondPageItem,
  scrollableItemsResponse,
  refreshedSearchResponse,
  emptyResponse,
  categoriesResponse,
  brandsResponse,
  filterLimitBrandsResponse,
  stovesCategoryResponse,
  filterLimitCategoryResponse,
  serverErrorResponse,
  malformedNumberFilter,
  respondToMalformedNumberFilter,
  respondWithEmptyItems,
  respondWithItemDetail,
  respondWithLoadMore,
  createGatedLoadMoreResponder,
  createFailingLoadMoreResponder,
  createStaleLoadMoreResponder,
  respondFromState,
  createDeferred,
  createStaleCategoryRequestConfig,
  buildRouteSearch,
  mockCatalogApi,
  mockGuestLogin,
  mockItemDetailApi,
  openGearLibrary,
  openFilterDialog,
  expectRouteSearch,
  getLastRequest,
  getRequiredLoadMoreItem,
  hasHistoryStateKey,
  clearGearLibraryItemsSnapshot,
  getScrollDistance,
  isStovesItemsRequest,
  isSecondPageItemsRequest,
  isStovesCategoryDetailRequest,
  waitForNextItemsRequest,
  expectQueryValues,
  getElementBox,
  getGearLibrarySelect,
  getPerdSelectOptions,
  getPerdSelectOption,
  selectPerdOption,
  expectPerdSelectValue,
  hasVisibleFocusOutline,
  waitForInlineEndAnchoring,
  waitForBlockEndAnchoring,
}
