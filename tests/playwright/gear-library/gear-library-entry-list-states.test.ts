import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  type MutableResponseState,
  firstPageResponse,
  refreshedSearchResponse,
  emptyResponse,
  categoriesResponse,
  brandsResponse,
  stovesCategoryResponse,
  serverErrorResponse,
  respondWithEmptyItems,
  respondFromState,
  createDeferred,
  mockCatalogApi,
  openGearLibrary,
  openFilterDialog,
  expectRouteSearch,
  waitForNextItemsRequest,
  expectQueryValues,
  getElementBox,
  getGearLibrarySelect,
  getPerdSelectOption,
  selectPerdOption,
  expectPerdSelectValue,
  mockGuestLogin,
} from '../fixtures/gear-library-entry-list.fixtures.ts'

test.describe('Gear library states', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
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
    const categorySelect = getGearLibrarySelect(searchRegion, 'Category')
    const sortSelect = getGearLibrarySelect(searchRegion, 'Sort by')
    const searchBoxBefore = await getElementBox(searchRegion)
    const resultsBoxBefore = await getElementBox(resultsBody)

    await selectPerdOption(categorySelect, 'stoves')
    await expect(sortSelect).toBeDisabled()
    await expect(sortSelect.locator('..').getByTestId('perd-select-progress')).toBeVisible()

    const searchBoxDuring = await getElementBox(searchRegion)
    const resultsBoxDuring = await getElementBox(resultsBody)

    expect(searchBoxDuring.height).toBeCloseTo(searchBoxBefore.height, 1)
    expect(resultsBoxDuring.y).toBeCloseTo(resultsBoxBefore.y, 1)

    await expect(page.getByText('Loading category details', { exact: true })).toHaveCount(0)

    categoryDetailGate.resolve()

    await expect(sortSelect).toBeEnabled()
    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)
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

    const initialSortSelect = getGearLibrarySelect(page, 'Sort by')

    await expect(getPerdSelectOption(initialSortSelect, 'property:weight:asc'))
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

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const categoriesAlert = page.getByRole('alert').filter({ hasText: 'Categories unavailable.' })

    await expect(categorySelect).toBeEnabled()
    await expect(getPerdSelectOption(categorySelect, 'stoves')).toHaveCount(1)
    await expect(categoriesAlert).toHaveCount(0)

    const categoryDetailFailurePromise = page.waitForResponse(
      '**/api/equipment/categories/by-slug/stoves'
    )

    await selectPerdOption(categorySelect, 'stoves')

    const categoryDetailFailure = await categoryDetailFailurePromise

    expect(categoryDetailFailure.status()).toBe(500)

    const sortSelect = getGearLibrarySelect(page, 'Sort by')

    const categoryDetailAlert = page.getByRole('alert').filter({
      hasText: 'Category filters and property sorting unavailable.'
    })

    await expect(sortSelect).toBeEnabled()
    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)
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

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const currentCategoryOption = getPerdSelectOption(categorySelect, 'stoves')

    await expect(page.getByRole('alert').filter({ hasText: 'Categories unavailable.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(categorySelect).toBeEnabled()
    await expectPerdSelectValue(categorySelect, 'stoves')
    await expect(currentCategoryOption).toBeDisabled()

    const itemsBeforeClear = tracker.items.length

    await selectPerdOption(categorySelect, '')

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

    const orderingSelect = getGearLibrarySelect(page, 'Sort by')
    const unavailableOrderingOption = getPerdSelectOption(orderingSelect, 'property:weight:desc')

    await expect(page.getByRole('alert').filter({
      hasText: 'Category filters and property sorting unavailable.'
    })).toBeVisible()

    await expect(page.getByRole('link', { name: 'PocketRocket Deluxe' })).toBeVisible()
    await expect(orderingSelect).toBeEnabled()
    await expectPerdSelectValue(orderingSelect, 'property:weight:desc')
    await expect(unavailableOrderingOption).toBeDisabled()

    const itemsBeforeOrdering = tracker.items.length

    await selectPerdOption(orderingSelect, 'brand:desc')

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

    const categorySelect = getGearLibrarySelect(page, 'Category')

    await expect(getPerdSelectOption(categorySelect, 'stoves')).toHaveCount(1)
    await selectPerdOption(categorySelect, 'stoves')

    const propertySortAlert = page.getByRole('alert')
      .filter({ hasText: 'Category filters and property sorting unavailable.' })

    await expect(propertySortAlert).toBeVisible()
    await expect(itemLink).toBeVisible()

    const categoryDetailsBeforeRetry = tracker.categoryDetails.length

    categoryDetailState.response = { json: stovesCategoryResponse }

    await propertySortAlert.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => tracker.categoryDetails.length).toBeGreaterThan(categoryDetailsBeforeRetry)

    const sortSelect = getGearLibrarySelect(page, 'Sort by')

    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)
  })
})
