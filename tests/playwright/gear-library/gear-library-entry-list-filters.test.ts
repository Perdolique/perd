import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  type QueryEntry,
  categoriesResponse,
  filterLimitBrandsResponse,
  filterLimitCategoryResponse,
  serverErrorResponse,
  respondWithLoadMore,
  createDeferred,
  createStaleCategoryRequestConfig,
  buildRouteSearch,
  mockCatalogApi,
  openGearLibrary,
  openFilterDialog,
  expectRouteSearch,
  isStovesItemsRequest,
  isStovesCategoryDetailRequest,
  waitForNextItemsRequest,
  expectQueryValues,
  getElementBox,
  getGearLibrarySelect,
  getPerdSelectOptions,
  getPerdSelectOption,
  selectPerdOption,
  expectPerdSelectValue,
  waitForBlockEndAnchoring,
  mockGuestLogin,
} from '../fixtures/gear-library-entry-list.fixtures.ts'

test.describe('Gear library filters', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
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
      ['brand', 'msr']
    ]

    const initialSearch = buildRouteSearch([
      ['q', 'old'],
      ['brand', 'msr'],
      ...propertyFilterEntries
    ])

    await openGearLibrary(page, `/gear-library${initialSearch}`)

    const searchRegion = page.getByRole('search', { name: 'Gear library search' })
    const searchInput = searchRegion.getByLabel('Search gear')
    const categorySelect = getGearLibrarySelect(searchRegion, 'Category')
    const sortSelect = getGearLibrarySelect(searchRegion, 'Sort by')

    const itemsBeforeCategory = tracker.items.length

    await selectPerdOption(categorySelect, 'stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)

    const categorySearch = buildRouteSearch([
      ['q', 'old'],
      ['category', 'stoves'],
      ...preservedEntries
    ])

    await expectRouteSearch(page, categorySearch)
    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)

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
    await expectPerdSelectValue(categorySelect, '')
    await page.goForward()
    await expectRouteSearch(page, searchedRoute)
    await expect(searchInput).toHaveValue('rocket')
    await expectPerdSelectValue(categorySelect, 'stoves')
    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)

    const itemsBeforeOrdering = tracker.items.length

    await selectPerdOption(sortSelect, 'property:weight:desc')

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
    await expectPerdSelectValue(sortSelect, 'name:asc')
    await page.goForward()
    await expectRouteSearch(page, orderedRoute)
    await expectPerdSelectValue(sortSelect, 'property:weight:desc')
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
    await expectPerdSelectValue(categorySelect, 'stoves')
    await expectPerdSelectValue(sortSelect, 'property:weight:desc')
  })

  test('should reset ordering when the category changes', async ({ context, page }) => {
    const tracker = await mockCatalogApi(context)

    await openGearLibrary(page)

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const sortSelect = getGearLibrarySelect(page, 'Sort by')
    const itemsBeforeBrandOrdering = tracker.items.length

    await selectPerdOption(sortSelect, 'brand:desc')
    await waitForNextItemsRequest(tracker, itemsBeforeBrandOrdering)
    await expectRouteSearch(page, '?sort=brand&direction=desc')

    const itemsBeforeCategory = tracker.items.length

    await selectPerdOption(categorySelect, 'stoves')
    await waitForNextItemsRequest(tracker, itemsBeforeCategory)
    await expectRouteSearch(page, '?category=stoves')
    await expectPerdSelectValue(sortSelect, 'name:asc')
    await expect(getPerdSelectOption(sortSelect, 'property:weight:asc')).toHaveCount(1)

    const itemsBeforePropertyOrdering = tracker.items.length

    await selectPerdOption(sortSelect, 'property:weight:desc')
    await waitForNextItemsRequest(tracker, itemsBeforePropertyOrdering)
    await expectRouteSearch(page, '?category=stoves&sort=property%3Aweight&direction=desc')

    const itemsBeforeClearingCategory = tracker.items.length

    await selectPerdOption(categorySelect, '')

    const clearedCategoryRequest = await waitForNextItemsRequest(tracker, itemsBeforeClearingCategory)

    await expectRouteSearch(page, '')
    await expectPerdSelectValue(sortSelect, 'name:asc')

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

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const orderingSelect = getGearLibrarySelect(page, 'Sort by')

    await expect(categorySelect).toBeDisabled()
    await expect(getPerdSelectOption(categorySelect, 'unknown-category')).toHaveCount(0)
    await expect(orderingSelect).toBeEnabled()
    await expectPerdSelectValue(orderingSelect, 'property:unknown-property:desc')

    const unavailableOrderingOption = getPerdSelectOption(
      orderingSelect,
      'property:unknown-property:desc'
    )

    await expect(unavailableOrderingOption).toBeDisabled()
    await expect(unavailableOrderingOption).toContainText('Current property sorting unavailable')

    const itemsBeforeNormalization = tracker.items.length

    categoriesGate.resolve()

    await expectRouteSearch(page, '')
    await waitForNextItemsRequest(tracker, itemsBeforeNormalization)
    await expectPerdSelectValue(categorySelect, '')
    await expectPerdSelectValue(orderingSelect, 'name:asc')

    const propertyTracker = await mockCatalogApi(context)

    await openGearLibrary(page, '/gear-library?category=stoves&sort=property%3Amissing&direction=desc')
    await expectRouteSearch(page, '?category=stoves')
    await expect.poll(() => propertyTracker.categoryDetails.length).toBeGreaterThan(0)
    await expectPerdSelectValue(orderingSelect, 'name:asc')
    await expect(getPerdSelectOptions(orderingSelect).filter({ hasText: /missing/u })).toHaveCount(0)
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

      await expect(
        brandGroup.getByRole('button', { name: 'Show fewer' })
      ).toHaveAttribute('aria-expanded', 'true')
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
    const categorySelect = getGearLibrarySelect(page, 'Category')

    await selectPerdOption(categorySelect, 'stoves')
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

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const itemsBeforeCategory = tracker.items.length

    await selectPerdOption(categorySelect, 'stoves')
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

    const categorySelect = getGearLibrarySelect(page, 'Category')
    const itemsBeforeCategory = tracker.items.length

    await selectPerdOption(categorySelect, 'stoves')
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

    const categorySelect = getGearLibrarySelect(page, 'Category')

    await selectPerdOption(categorySelect, 'stoves')

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

    await selectPerdOption(categorySelect, 'sleeping-pads')

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

    const sortSelect = getGearLibrarySelect(page, 'Sort by')

    await expect(getPerdSelectOption(sortSelect, 'property:r-value:asc')).toHaveCount(1)
  })
})
