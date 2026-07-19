import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  scrollableItemsResponse,
  refreshedSearchResponse,
  malformedNumberFilter,
  respondToMalformedNumberFilter,
  buildRouteSearch,
  mockCatalogApi,
  openGearLibrary,
  openFilterDialog,
  expectRouteSearch,
  getLastRequest,
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
  mockGuestLogin,
} from '../fixtures/gear-library-entry-list.fixtures.ts'

test.describe('Gear library layout and accessibility', () => {
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
    const categorySelect = getGearLibrarySelect(searchRegion, 'Category')
    const sortSelect = getGearLibrarySelect(searchRegion, 'Sort by')

    await expect(page.getByRole('heading', { name: 'Gear library', exact: true })).toBeVisible()
    await expect(searchRegion.getByLabel('Search gear')).toHaveAttribute('type', 'search')
    await expectPerdSelectValue(categorySelect, '')
    await expectPerdSelectValue(sortSelect, 'name:asc')

    const sortOptions = getPerdSelectOptions(sortSelect)

    await expect(sortOptions).toHaveCount(4)
    await expect(sortOptions.nth(0)).toContainText('Name: A–Z')
    await expect(sortOptions.nth(1)).toContainText('Name: Z–A')
    await expect(sortOptions.nth(2)).toContainText('Brand: A–Z')
    await expect(sortOptions.nth(3)).toContainText('Brand: Z–A')
    await expect(page.getByRole('complementary', { name: 'Catalog filters' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()

    const categoryOptions = getPerdSelectOptions(categorySelect)

    await expect(categoryOptions).toHaveCount(3)
    await expect(categoryOptions.nth(0)).toContainText('All categories')
    await expect(categoryOptions.nth(1)).toContainText('Sleeping Pads')
    await expect(categoryOptions.nth(2)).toContainText('Stoves')

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

  test('should commit the active select option with Tab', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const sortSelect = getGearLibrarySelect(page, 'Sort by')
    const allCategoriesOption = getPerdSelectOption(categorySelect, '')
    const sleepingPadsOption = getPerdSelectOption(categorySelect, 'sleeping-pads')

    await categorySelect.focus()
    await page.keyboard.press('Enter')

    await expect(categorySelect).toHaveAttribute('aria-expanded', 'true')
    await expect(allCategoriesOption).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('ArrowDown')

    await expect(categorySelect).toHaveAttribute('aria-activedescendant', /-option-1$/u)
    await expect(categorySelect).toHaveAttribute('data-value', '')
    await expect(allCategoriesOption).toHaveAttribute('aria-selected', 'false')
    await expect(sleepingPadsOption).toHaveAttribute('aria-selected', 'true')

    const itemsBeforeCategory = tracker.items.length

    await page.keyboard.press('Tab')
    await expect(sortSelect).toBeFocused()

    const categoryRequest = await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    await expect(categorySelect).toHaveAttribute('aria-expanded', 'false')
    await expectPerdSelectValue(categorySelect, 'sleeping-pads')
    expect(categoryRequest.searchParams.get('categorySlug')).toBe('sleeping-pads')
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
    const categorySelect = getGearLibrarySelect(page, 'Category')

    await selectPerdOption(categorySelect, 'stoves')
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
    const categorySelect = getGearLibrarySelect(searchRegion, 'Category')
    const sortSelect = getGearLibrarySelect(searchRegion, 'Sort by')
    const clearButton = searchRegion.getByRole('button', { name: 'Clear search' })
    const filtersButton = page.getByRole('button', { name: 'Filters 5' })

    const appliedFilterButtons = page
      .getByRole('list', { name: 'Applied filters' })
      .getByRole('button')

    const clearAllButton = page.getByRole('button', { name: 'Clear all' })
    const detailLink = page.getByRole('link', { name: 'PocketRocket Deluxe' })
    const resultsBody = page.getByTestId('gear-library-results-body')

    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)
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
    const categorySelect = getGearLibrarySelect(page, 'Category')
    const sortSelect = getGearLibrarySelect(page, 'Sort by')
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
})
