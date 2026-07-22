import type { Locator, Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  buildRouteSearch,
  createDeferred,
  expectRouteSearch,
  firstPageResponse,
  getGearLibrarySelect,
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  respondWithItemDetail,
  scrollableItemsResponse,
  secondPageItem,
  selectPerdOption,
  serverErrorResponse,
  sleepingPadItem
} from '../fixtures/gear-library-entry-list.fixtures.ts'

function isSecondPageItemDetailRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === `/api/equipment/items/${secondPageItem.id}`
}

const respondWithServerErrorItemDetail: typeof respondWithItemDetail = () => serverErrorResponse
const comparisonLimitMessage = 'You can compare up to 4 items. Remove one to select another.'

async function expectAllCheckboxesDisabled(checkboxes: Locator) {
  await expect.poll(async () => checkboxes.evaluateAll(
    (elements) => elements.every((element) => element.matches(':disabled'))
  )).toBe(true)
}

async function expectAllCheckboxesEnabled(checkboxes: Locator) {
  await expect.poll(async () => checkboxes.evaluateAll(
    (elements) => elements.every((element) => element.matches(':disabled') === false)
  )).toBe(true)
}

function createSleepingPadsItemsResponder(waitFor: Promise<void>) {
  return (request: { url: InstanceType<typeof globalThis.URL> }) => {
    if (request.url.searchParams.get('categorySlug') === 'sleeping-pads') {
      return {
        json: {
          items: [sleepingPadItem],
          limit: 10,
          page: 1,
          total: 1
        },
        waitFor
      }
    }

    return { json: firstPageResponse }
  }
}

test.describe('Gear library comparison selection', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should preserve ordered selection with replace history and reject a fifth item', async ({ context, page }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })
    await openGearLibrary(page, '/gear-library?category=stoves')

    const [firstItem, secondItem, thirdItem, fourthItem, fifthItem] = scrollableItemsResponse.items

    const initialHistoryLength = await page.evaluate(() => globalThis.history.length)
    const selectedItems = [firstItem, secondItem, thirdItem, fourthItem]

    await page.getByRole('button', { name: 'Compare items' }).click()
    await page.getByRole('checkbox', { name: `Select ${firstItem.name}` }).check()
    await page.getByRole('checkbox', { name: `Select ${secondItem.name}` }).check()
    await page.getByRole('checkbox', { name: `Select ${thirdItem.name}` }).check()
    await page.getByRole('checkbox', { name: `Select ${fourthItem.name}` }).check()

    const selectedSearch = buildRouteSearch([
      ['category', 'stoves'],
      ...selectedItems.map((item) => ['compare', item.id] as const)
    ])

    await expectRouteSearch(page, selectedSearch)
    await expect(page.getByText('4 of 4 selected')).toBeVisible()

    const selectionHistoryLength = await page.evaluate(() => globalThis.history.length)

    expect(selectionHistoryLength).toBe(initialHistoryLength)

    const fifthCheckbox = page.getByRole('checkbox', { name: `Select ${fifthItem.name}` })

    await fifthCheckbox.click()

    await expect(fifthCheckbox).not.toBeChecked()
    await expect(page.getByText(comparisonLimitMessage)).toBeVisible()
    await expectRouteSearch(page, selectedSearch)

    await page.getByRole('button', {
      name: `Remove ${firstItem.name} from comparison`
    }).click()

    const remainingItems = selectedItems.slice(1)
    const remainingSearch = buildRouteSearch([
      ['category', 'stoves'],
      ...remainingItems.map((item) => ['compare', item.id] as const)
    ])

    await expectRouteSearch(page, remainingSearch)
    await expect(page.getByText(comparisonLimitMessage)).toHaveCount(0)

    const searchInput = page.getByRole('search', { name: 'Gear library search' }).getByLabel('Search gear')

    await searchInput.fill('rocket')

    const searchedSelection = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ...remainingItems.map((item) => ['compare', item.id] as const)
    ])

    await expectRouteSearch(page, searchedSelection)
    await page.reload()
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page.getByText('3 of 4 selected')).toBeVisible()
    await expect(
      page.getByTestId('gear-library-comparison-tray').getByText(secondItem.name, { exact: true })
    ).toBeVisible()
  })

  test('should enable category controls together after refresh', async ({ context, page }) => {
    const sleepingPadsGate = createDeferred()

    await mockCatalogApi(context, {
      items: createSleepingPadsItemsResponder(sleepingPadsGate.promise)
    })

    await openGearLibrary(page)

    await expect(page.getByRole('button', { name: 'Compare items' })).toHaveCount(0)

    await selectPerdOption(getGearLibrarySelect(page, 'Category'), 'sleeping-pads')
    await page.getByRole('button', { name: 'Compare items' }).click()

    const pendingComparisonCheckboxes = page.getByRole('checkbox', { name: /^Select /u })

    await expect(pendingComparisonCheckboxes).toHaveCount(firstPageResponse.items.length)
    await expectAllCheckboxesDisabled(pendingComparisonCheckboxes)

    sleepingPadsGate.resolve()

    await expect(pendingComparisonCheckboxes).toHaveCount(1)
    await expectAllCheckboxesEnabled(pendingComparisonCheckboxes)
  })

  test('should keep the mobile tray collapsed and remember its disclosure state', async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })

    await openGearLibrary(page, '/gear-library?category=stoves')
    await page.getByRole('button', { name: 'Compare items' }).click()

    const [firstItem, secondItem] = scrollableItemsResponse.items
    const firstCheckbox = page.getByRole('checkbox', { name: `Select ${firstItem.name}` })
    const comparisonControl = firstCheckbox.locator('..')
    const controlBox = await comparisonControl.boundingBox()

    expect(controlBox).not.toBeNull()
    expect(controlBox?.width).toBeGreaterThanOrEqual(44)
    expect(controlBox?.height).toBeGreaterThanOrEqual(44)
    await expect(comparisonControl.getByText('Select', { exact: true })).toBeVisible()

    await firstCheckbox.check()

    const tray = page.getByTestId('gear-library-comparison-tray')
    const itemList = tray.getByRole('list')
    const showItemsButton = tray.getByRole('button', { name: 'Show items' })

    await expect(itemList).toBeHidden()
    await expect(showItemsButton).toHaveAttribute('aria-expanded', 'false')

    await showItemsButton.click()

    const hideItemsButton = tray.getByRole('button', { name: 'Hide items' })

    await expect(itemList).toBeVisible()
    await expect(hideItemsButton).toHaveAttribute('aria-expanded', 'true')

    await page.getByRole('checkbox', { name: `Select ${secondItem.name}` }).check()
    await expect(itemList).toBeVisible()

    await tray.getByRole('button', { name: `Remove ${firstItem.name} from comparison` }).click()
    await expect(itemList).toBeVisible()
    await expect(hideItemsButton).toHaveAttribute('aria-expanded', 'true')
  })

  test('should restore empty comparison mode on Back, reset it on reload, and cancel without confirmation', async ({
    context,
    page
  }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })
    await openGearLibrary(page, '/gear-library?category=stoves')

    const [firstItem] = scrollableItemsResponse.items
    const documentHeightBeforeMode = await page.evaluate(
      () => globalThis.document.documentElement.scrollHeight
    )

    await page.getByRole('button', { name: 'Compare items' }).click()
    await expect(page.getByText('0 of 4 selected')).toBeVisible()
    await expect.poll(async () => page.evaluate(
      () => globalThis.document.documentElement.scrollHeight
    )).toBe(documentHeightBeforeMode)

    await page.getByRole('link', { name: firstItem.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/gear-library/${firstItem.id}$`, 'u'))

    await page.goBack()

    await expect(page).toHaveURL(/\/gear-library\?category=stoves$/u)
    await expect(page.getByRole('button', { name: 'Cancel comparison' })).toBeVisible()
    await expect(page.getByText('0 of 4 selected')).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page.getByRole('button', { name: 'Compare items' })).toBeVisible()
    await expect(page.getByTestId('gear-library-comparison-tray')).toHaveCount(0)

    await page.getByRole('button', { name: 'Compare items' }).click()
    await page.getByRole('checkbox', { name: `Select ${firstItem.name}` }).check()
    await page.getByRole('button', { name: 'Cancel comparison' }).click()

    await expectRouteSearch(page, buildRouteSearch([['category', 'stoves']]))
    await expect(page.getByRole('dialog', { name: 'Clear comparison selection?' })).toHaveCount(0)
    await expect(page.getByTestId('gear-library-comparison-tray')).toHaveCount(0)
  })

  test('should reset and expire the comparison limit notice without moving it to the page', async ({ context, page }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })
    await page.clock.install()

    await openGearLibrary(page, '/gear-library?category=stoves')
    await page.getByRole('button', { name: 'Compare items' }).click()

    const [firstItem, secondItem, thirdItem, fourthItem, fifthItem] = scrollableItemsResponse.items
    const selectedItems = [firstItem, secondItem, thirdItem, fourthItem]

    for (const item of selectedItems) {
      // oxlint-disable-next-line no-await-in-loop -- URL-backed selections must update in order.
      await page.getByRole('checkbox', { name: `Select ${item.name}` }).check()
    }

    const fifthCheckbox = page.getByRole('checkbox', { name: `Select ${fifthItem.name}` })

    await fifthCheckbox.click()
    await expect(page.getByText(comparisonLimitMessage)).toBeVisible()

    await page.clock.fastForward(3000)
    await expect(page.getByText(comparisonLimitMessage)).toBeVisible()

    await fifthCheckbox.click()
    await page.clock.fastForward(3000)
    await expect(page.getByText(comparisonLimitMessage)).toBeVisible()

    await page.clock.fastForward(3000)
    await expect(page.getByText(comparisonLimitMessage)).toHaveCount(0)

    await fifthCheckbox.click()
    await expect(page.getByText(comparisonLimitMessage)).toBeVisible()

    const tray = page.getByTestId('gear-library-comparison-tray')

    for (const item of selectedItems) {
      // oxlint-disable-next-line no-await-in-loop -- Each removal changes the next rendered tray state.
      await tray.getByRole('button', { name: `Remove ${item.name} from comparison` }).click()
    }

    await expect(tray).toBeVisible()
    await expect(tray.getByText('0 of 4 selected')).toBeVisible()
    await expect(tray.getByText('Select 2 to 4 items')).toBeVisible()
    await expect(page.getByText(comparisonLimitMessage)).toHaveCount(0)
  })

  test('should canonicalize malformed, duplicate, and over-limit comparison state visibly', async ({ context, page }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })

    const [firstItem, secondItem, thirdItem, fourthItem, fifthItem] = scrollableItemsResponse.items

    const rawSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', 'malformed'],
      ['compare', firstItem.id],
      ['compare', secondItem.id],
      ['compare', secondItem.id],
      ['compare', thirdItem.id],
      ['compare', fourthItem.id],
      ['compare', fifthItem.id]
    ])

    await openGearLibrary(page, `/gear-library${rawSearch}`)

    const canonicalSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', firstItem.id],
      ['compare', secondItem.id],
      ['compare', thirdItem.id],
      ['compare', fourthItem.id]
    ])

    await expectRouteSearch(page, canonicalSearch)
    await expect(page.getByText(
      'Comparison selection was adjusted: invalid item IDs were removed; duplicate item IDs were removed; only the first 4 items were kept.'
    )).toBeVisible()
  })

  test('should keep transient detail failures selected and retry them', async ({ context, page }) => {
    let activeItemDetailResponder = respondWithServerErrorItemDetail

    await mockCatalogApi(context, {
      items: () => {
        return { json: firstPageResponse }
      },
      itemDetails: (request) => activeItemDetailResponder(request)
    })

    const selectedSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', secondPageItem.id]
    ])

    await openGearLibrary(page, `/gear-library${selectedSearch}`)

    await expect(page.getByText('Could not load selected item.')).toBeVisible()
    await expectRouteSearch(page, selectedSearch)

    activeItemDetailResponder = respondWithItemDetail

    await page.getByRole('button', { name: 'Retry selected items' }).click()

    await expect(page.getByText(secondPageItem.name, { exact: true })).toBeVisible()
    await expectRouteSearch(page, selectedSearch)
  })

  test('should remove unavailable and mixed-category restored IDs in one canonical update', async ({ context, page }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: firstPageResponse }
      }
    })

    const unavailableItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477ee'
    const rawSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', unavailableItemId],
      ['compare', sleepingPadItem.id]
    ])

    await openGearLibrary(page, `/gear-library${rawSearch}`)

    await expectRouteSearch(page, buildRouteSearch([['category', 'stoves']]))
    await expect(page.getByText(
      'Some comparison items were removed because they are unavailable or belong to another category.'
    )).toBeVisible()
  })

  test('should confirm category clearing and cancel stale summary restoration', async ({ context, page }) => {
    const detailGate = createDeferred()
    const staleRequestFailure = page.waitForEvent('requestfailed', isSecondPageItemDetailRequest)

    const tracker = await mockCatalogApi(context, {
      items: () => {
        return { json: firstPageResponse }
      },
      itemDetails: (request) => {
        const response = respondWithItemDetail(request)

        return {
          ...response,
          waitFor: detailGate.promise
        }
      }
    })

    const selectedSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', secondPageItem.id]
    ])

    await openGearLibrary(page, `/gear-library${selectedSearch}`)
    await expect.poll(() => tracker.itemDetails.length).toBe(1)

    const categorySelect = getGearLibrarySelect(page, 'Category')

    await selectPerdOption(categorySelect, 'sleeping-pads')

    const dialog = page.getByRole('dialog', { name: 'Clear comparison selection?' })

    await expect(dialog).toContainText('Changing the category removes 1 selected items.')
    await dialog.getByRole('button', { name: 'Keep current category' }).click()
    await expectRouteSearch(page, selectedSearch)

    await selectPerdOption(categorySelect, 'sleeping-pads')
    await dialog.getByRole('button', { name: 'Change category' }).click()

    await staleRequestFailure
    detailGate.resolve()

    await expectRouteSearch(page, buildRouteSearch([['category', 'sleeping-pads']]))
    const emptyComparisonTray = page.getByTestId('gear-library-comparison-tray')

    await expect(emptyComparisonTray).toBeVisible()
    await expect(emptyComparisonTray.getByText('0 of 4 selected')).toBeVisible()
  })

  test('should clear comparison state without a category and explain it', async ({ context, page }) => {
    await mockCatalogApi(context)

    const rawSearch = buildRouteSearch([
      ['compare', secondPageItem.id]
    ])

    await openGearLibrary(page, `/gear-library${rawSearch}`)

    await expectRouteSearch(page, '')
    await expect(page.getByText(
      'Comparison selection was cleared because no category is selected.'
    )).toBeVisible()
  })
})
