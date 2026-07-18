import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  type LoadMoreFailureState,
  respondWithLoadMore,
  createGatedLoadMoreResponder,
  createFailingLoadMoreResponder,
  createStaleLoadMoreResponder,
  createDeferred,
  mockCatalogApi,
  mockItemDetailApi,
  openGearLibrary,
  expectRouteSearch,
  getLastRequest,
  getRequiredLoadMoreItem,
  hasHistoryStateKey,
  clearGearLibraryItemsSnapshot,
  getScrollDistance,
  isSecondPageItemsRequest,
  waitForNextItemsRequest,
  expectQueryValues,
  mockGuestLogin,
} from '../fixtures/gear-library-entry-list.fixtures.ts'

test.describe('Gear library Load more', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should append one ten-item page per action without exposing browsing depth in the URL', async ({ context, page }) => {
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
    await expect(page.getByRole('heading', { level: 1, name: detailItem.name })).toBeVisible()

    const detailUrl = new globalThis.URL(page.url())

    expect(detailUrl.pathname).toBe(`/gear-library/${detailItem.id}`)
    expect(detailUrl.searchParams.get('batch')).toBeNull()
    expect(detailUrl.searchParams.get('returnTo')).toBeNull()
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

    expect(savedScrollTop).toBeGreaterThan(0)

    await expect(detailLink).toHaveAttribute('href', `/gear-library/${detailItem.id}`)

    await detailLink.click()
    await expect(page.getByRole('heading', { level: 1, name: detailItem.name })).toBeVisible()

    await page.goBack()
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

  test('should fall back to page one at the top when the cached Back prefix is missing', async ({ context, page }) => {
    const detailItem = getRequiredLoadMoreItem(22)

    const tracker = await mockCatalogApi(context, {
      items: respondWithLoadMore
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
    await expect(page.getByRole('heading', { level: 1, name: detailItem.name })).toBeVisible()
    await clearGearLibraryItemsSnapshot(page)

    const requestsBeforeBack = tracker.items.length

    await page.goBack()
    await expect(results.getByRole('listitem')).toHaveCount(10)
    await expect.poll(() => tracker.items.length).toBeGreaterThan(requestsBeforeBack)

    const restorationPages = tracker.items.slice(requestsBeforeBack).map((request) => (
      request.searchParams.get('page')
    ))

    expect(restorationPages.every((pageNumber) => pageNumber === '1')).toBe(true)
    await expect.poll(async () => page.evaluate(() => globalThis.scrollY)).toBe(0)
    await expect.poll(async () => getScrollDistance(page, savedScrollTop)).toBeGreaterThan(2)

    const hasUnconsumedBrowsingState = await hasHistoryStateKey(page, 'gearLibraryBrowsing')

    expect(hasUnconsumedBrowsingState).toBe(false)
  })
})
