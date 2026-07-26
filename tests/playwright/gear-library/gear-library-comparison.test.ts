import type { Locator, Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  comparisonItemIds,
  comparisonItems,
  comparisonResponse,
  createComparisonPath,
  createComparisonResponse,
  mockComparisonApi,
  openComparisonPage
} from '../fixtures/gear-library-comparison.fixtures.ts'
import {
  buildRouteSearch,
  createDeferred,
  getElementBox,
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  scrollableItemsResponse
} from '../fixtures/gear-library-entry-list.fixtures.ts'

function getComparisonItemIds(request: Request) {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.searchParams.getAll('itemId')
}

function getRequiredRequest(requests: Request[], index = 0) {
  return requests[index]
}

function getRequiredCatalogItem(index: number) {
  return scrollableItemsResponse.items[index]
}

async function getComparisonColumnWidths(table: Locator) {
  const columnHeaders = await table.getByRole('columnheader').all()
  const columnBoxes = await Promise.all(
    columnHeaders.map(async (columnHeader) => getElementBox(columnHeader))
  )

  return columnBoxes.map((box) => box.width)
}

function expectComparisonColumnWidths(columnWidths: number[]) {
  const propertyColumnWidth = columnWidths.at(0)
  const itemColumnWidths = columnWidths.slice(1)
  const firstItemColumnWidth = itemColumnWidths.at(0)

  if (propertyColumnWidth === undefined || firstItemColumnWidth === undefined) {
    throw new Error('Expected property and item comparison columns')
  }

  expect(propertyColumnWidth).toBeCloseTo(144, 0)
  expect(firstItemColumnWidth).toBeGreaterThanOrEqual(208)
  expect(firstItemColumnWidth).toBeLessThanOrEqual(320)

  for (const itemColumnWidth of itemColumnWidths.slice(1)) {
    expect(itemColumnWidth).toBeCloseTo(firstItemColumnWidth, 0)
  }
}

function getFirstItemColumnWidth(columnWidths: number[]) {
  const firstItemColumnWidth = columnWidths.at(1)

  if (firstItemColumnWidth === undefined) {
    throw new Error('Expected an item comparison column')
  }

  return firstItemColumnWidth
}

function createComparisonCatalogItemDetail(itemId?: string) {
  const item = comparisonItems.find((comparisonItem) => comparisonItem.id === itemId)

  if (item === undefined) {
    return {
      json: { statusCode: 404 },
      status: 404
    }
  }

  return {
    json: {
      brand: {
        id: 1,
        name: item.brand.name,
        slug: item.brand.slug
      },
      category: {
        id: comparisonResponse.category.id,
        name: comparisonResponse.category.name,
        slug: comparisonResponse.category.slug
      },
      createdAt: '2088-04-20T12:00:00.000Z',
      id: item.id,
      name: item.name,
      properties: []
    }
  }
}

async function navigateWithinApp(page: Parameters<typeof openComparisonPage>[0], path: string) {
  await page.evaluate(async (nextPath) => {
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
    const router = getRequiredProperty(globalProperties, '$router')
    const push = getRequiredProperty(router, 'push')

    if (typeof push !== 'function') {
      throw new TypeError('Expected the Nuxt router push function')
    }

    await Reflect.apply(push, router, [nextPath])
  }, path)
}

function createGatedComparisonResponder(
  gatedItemIds: readonly string[],
  waitFor: Promise<void>
) {
  return (request: Request) => {
    const itemIds = getComparisonItemIds(request)
    const response = {
      json: createComparisonResponse(itemIds)
    }

    if (itemIds.join(',') === gatedItemIds.join(',')) {
      return {
        ...response,
        waitFor
      }
    }

    return response
  }
}

const directItemCounts = [2, 3, 4] as const
const invalidComparisonCases = [
  {
    itemIds: [comparisonItemIds[0]],
    message: 'Select 2 to 4 items to compare.',
    name: 'insufficient'
  },
  {
    itemIds: [comparisonItemIds[0], comparisonItemIds[0]],
    message: 'This comparison contains the same item more than once.',
    name: 'duplicate'
  },
  {
    itemIds: [...comparisonItemIds, '01980000-0000-7000-8000-000000000005'],
    message: 'This comparison contains more than 4 items.',
    name: 'over limit'
  },
  {
    itemIds: [comparisonItemIds[0], comparisonItemIds[1].toUpperCase()],
    message: 'This comparison link contains an invalid item ID.',
    name: 'malformed'
  }
] as const
const comparisonErrorCases = [
  {
    message: 'These items cannot be compared because they are not all from the same category.',
    status: 400
  },
  {
    message: 'One or more comparison items are unavailable.',
    status: 404
  }
] as const

test.describe('Gear library comparison page', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should start from the tray in URL and column order and preserve catalog history', async ({
    context,
    page
  }) => {
    await mockCatalogApi(context, {
      items: () => {
        return { json: scrollableItemsResponse }
      }
    })

    const selectedItems = [
      getRequiredCatalogItem(0),
      getRequiredCatalogItem(1)
    ]
    const selectedIds = selectedItems.map((item) => item.id)
    const selectedResponse = {
      ...comparisonResponse,
      items: selectedItems.map((item) => {
        return {
          brand: item.brand,
          id: item.id,
          name: item.name
        }
      }),
      properties: comparisonResponse.properties.map((property) => {
        return {
          ...property,
          values: selectedIds.map((itemId, index) => {
            return {
              itemId,
              value: index
            }
          })
        }
      })
    }

    const tracker = await mockComparisonApi(context, {
      comparison: () => {
        return { json: selectedResponse }
      }
    })

    const catalogSearch = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves']
    ])

    await openGearLibrary(page, `/gear-library${catalogSearch}`)
    await page.getByRole('button', { name: 'Compare items' }).click()

    const compareButton = page.getByRole('button', { name: 'Compare', exact: true })

    await page.getByRole('checkbox', { name: `Select ${selectedItems[0]?.name}` }).check()
    await expect(compareButton).toBeDisabled()

    await page.getByRole('checkbox', { name: `Select ${selectedItems[1]?.name}` }).check()
    await expect(compareButton).toBeEnabled()
    await compareButton.click()

    await expect(page).toHaveURL(createComparisonPath(selectedIds))
    await expect.poll(() => tracker.comparisons.length).toBe(1)
    const comparisonRequest = getRequiredRequest(tracker.comparisons)

    expect(getComparisonItemIds(comparisonRequest)).toStrictEqual(selectedIds)

    const columnHeaders = page.getByRole('columnheader')

    await expect(columnHeaders.nth(1)).toContainText(selectedItems[0].name)
    await expect(columnHeaders.nth(2)).toContainText(selectedItems[1].name)

    await page.goBack()
    const selectedCatalogSearch = buildRouteSearch([
      ['q', 'rocket'],
      ['category', 'stoves'],
      ...selectedIds.map((itemId) => ['compare', itemId] as const)
    ])

    await expect(page).toHaveURL(`/gear-library${selectedCatalogSearch}`)
    await expect(page.getByText('2 of 4 selected')).toBeVisible()
  })

  for (const itemCount of directItemCounts) {
    test(`should render a direct URL with ${itemCount} ordered items`, async ({
      context,
      page
    }) => {
      const tracker = await mockComparisonApi(context)
      const itemIds = comparisonItemIds.slice(0, itemCount)

      await openComparisonPage(page, itemIds)

      const table = page.getByRole('table', {
        name: `Stoves, ${itemCount} items`
      })

      await expect(table).toBeVisible()
      await expect(table.getByRole('columnheader')).toHaveCount(itemCount + 1)
      await expect(table.getByRole('rowheader')).toHaveCount(comparisonResponse.properties.length)

      const comparisonRequest = getRequiredRequest(tracker.comparisons)
      expect(getComparisonItemIds(comparisonRequest)).toStrictEqual(itemIds)

      const catalogLink = page.getByRole('link', { name: 'Edit compared items' })
      const expectedCatalogSearch = new globalThis.URLSearchParams()
      expectedCatalogSearch.append('category', 'stoves')

      for (const itemId of itemIds) {
        expectedCatalogSearch.append('compare', itemId)
      }

      await expect(catalogLink).toHaveAttribute(
        'href',
        `/gear-library?${expectedCatalogSearch.toString()}`
      )
    })
  }

  for (const invalidCase of invalidComparisonCases) {
    test(`should reject a locally ${invalidCase.name} URL without calling the API`, async ({
      context,
      page
    }) => {
      const tracker = await mockComparisonApi(context)

      await openComparisonPage(page, invalidCase.itemIds)

      await expect(page.getByText(invalidCase.message, { exact: true })).toBeVisible()
      expect(tracker.comparisons).toHaveLength(0)
      await expect(page.getByRole('link', { name: 'Edit compared items' })).toHaveAttribute(
        'href',
        '/gear-library'
      )
    })
  }

  for (const errorCase of comparisonErrorCases) {
    test(`should map a ${errorCase.status} response to a non-retryable state`, async ({
      context,
      page
    }) => {
      await mockComparisonApi(context, {
        comparison: () => {
          return { status: errorCase.status }
        }
      })

      await openComparisonPage(page)

      await expect(page.getByText(errorCase.message, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    })
  }

  test('should retry a server failure and render the complete matrix', async ({
    context,
    page
  }) => {
    const responseState: {
      response: {
        json?: object;
        status?: number;
      };
    } = {
      response: { status: 500 }
    }

    await mockComparisonApi(context, {
      comparison: () => responseState.response
    })

    await openComparisonPage(page)

    await expect(page.getByText('Could not load this comparison.', { exact: true })).toBeVisible()
    responseState.response = {
      json: createComparisonResponse(comparisonItemIds.slice(0, 3))
    }
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('table', { name: 'Stoves, 3 items' })).toBeVisible()
  })

  test('should abort a stale comparison request when item parameters change', async ({
    context,
    page
  }) => {
    const staleRequestGate = createDeferred()
    const staleItemIds = [
      comparisonItemIds[0],
      comparisonItemIds[1],
      comparisonItemIds[3]
    ]
    const finalItemIds = [
      comparisonItemIds[1],
      comparisonItemIds[2],
      comparisonItemIds[3]
    ]

    await mockComparisonApi(context, {
      comparison: createGatedComparisonResponder(staleItemIds, staleRequestGate.promise)
    })

    await openComparisonPage(page)
    await expect(page.getByRole('table', { name: 'Stoves, 3 items' })).toBeVisible()

    const staleRequestStarted = page.waitForRequest((request) => (
      getComparisonItemIds(request).join(',') === staleItemIds.join(',')
    ))
    const staleRequestFailure = page.waitForEvent('requestfailed', (request) => (
      new globalThis.URL(request.url()).searchParams.getAll('itemId').join(',')
        === staleItemIds.join(',')
    ))

    await navigateWithinApp(page, createComparisonPath(staleItemIds))
    await staleRequestStarted
    await navigateWithinApp(page, createComparisonPath(finalItemIds))

    const failedRequest = await staleRequestFailure

    expect(failedRequest.failure()?.errorText).toContain('ERR_ABORTED')
    staleRequestGate.resolve()

    await expect(page).toHaveURL(createComparisonPath(finalItemIds))
    await expect(page.getByRole('table', { name: 'Stoves, 3 items' })).toBeVisible()
    await expect(page.getByRole('columnheader').nth(1)).toContainText(comparisonItems[1].name)
  })

  test('should filter desktop rows by all visible raw values', async ({
    context,
    page
  }) => {
    await mockComparisonApi(context)
    await openComparisonPage(page)

    const table = page.getByRole('table', { name: 'Stoves, 3 items' })

    await expect(table.getByRole('rowheader')).toHaveText([
      'Weight',
      'Fuel type',
      'Piezo ignition'
    ])

    await page.getByRole('checkbox', { name: 'Show differences only' }).check()

    await expect(table.getByRole('rowheader')).toHaveText([
      'Weight',
      'Piezo ignition'
    ])
    await expect(table.getByText('—', { exact: true })).toBeVisible()

    const propertyHeaderPosition = await table.getByRole('rowheader').first().evaluate(
      (element) => globalThis.getComputedStyle(element).position
    )
    const itemHeaderPosition = await table.getByRole('columnheader').nth(1).evaluate(
      (element) => globalThis.getComputedStyle(element).position
    )

    expect(propertyHeaderPosition).toBe('sticky')
    expect(itemHeaderPosition).toBe('sticky')
  })

  test('should show every selected item on mobile with accessible hidden table labels', async ({
    context,
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const pageRequests: Request[] = []

    page.on('request', (request) => {
      pageRequests.push(request)
    })

    await mockComparisonApi(context)
    await openComparisonPage(page, comparisonItemIds)

    const table = page.getByRole('table', { name: 'Stoves, 4 items' })
    const columnHeaders = table.getByRole('columnheader')
    const cornerHeader = columnHeaders.first()
    const caption = table.locator('caption')

    await expect(table).toBeVisible()
    await expect(columnHeaders).toHaveCount(5)
    await expect(columnHeaders.nth(1)).toContainText('MSR')
    await expect(columnHeaders.nth(1)).toContainText(comparisonItems[0].name)
    await expect(cornerHeader).toHaveAccessibleName('Property')
    await expect(caption).toHaveText('Stoves, 4 items')

    const propertyLabel = cornerHeader.getByText('Property', { exact: true })
    const [captionBox, propertyLabelBox] = await Promise.all([
      getElementBox(caption),
      getElementBox(propertyLabel)
    ])
    const [captionClipPath, propertyLabelClipPath] = await Promise.all([
      caption.evaluate((element) => globalThis.getComputedStyle(element).clipPath),
      propertyLabel.evaluate((element) => globalThis.getComputedStyle(element).clipPath)
    ])

    expect(captionBox.width).toBe(1)
    expect(captionBox.height).toBe(1)
    expect(propertyLabelBox.width).toBe(1)
    expect(propertyLabelBox.height).toBe(1)
    expect(captionClipPath).toBe('inset(50%)')
    expect(propertyLabelClipPath).toBe('inset(50%)')
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /my gear/iu })).toHaveCount(0)
    await expect(table.getByRole('rowheader')).toHaveText([
      'Weight',
      'Fuel type',
      'Piezo ignition'
    ])

    await page.getByRole('checkbox', { name: 'Show differences only' }).check()

    await expect(table.getByRole('rowheader')).toHaveText([
      'Weight',
      'Piezo ignition'
    ])
    const membershipRequests = pageRequests.filter((request) => {
      const requestUrl = new globalThis.URL(request.url())

      return requestUrl.pathname.startsWith('/api/user/gear')
    })

    expect(membershipRequests).toHaveLength(0)
  })

  test('should keep the full mobile matrix horizontally scrollable and page wheel usable', async ({
    context,
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 500 })
    const longItemName = 'Enlightened Equipment Enigma 20F Regular'
    const shortItemName = 'Seed Sleeping Bag 03'
    const response = createComparisonResponse(comparisonItemIds)
    response.items = [
      {
        ...comparisonItems[0],
        name: longItemName
      },
      {
        ...comparisonItems[1],
        name: shortItemName
      },
      comparisonItems[2],
      comparisonItems[3]
    ]

    await mockComparisonApi(context, {
      comparison: () => {
        return { json: response }
      }
    })
    await openComparisonPage(page, comparisonItemIds)

    const table = page.getByRole('table', { name: 'Stoves, 4 items' })
    const scrollRegion = page.getByRole('region', {
      name: 'Stoves, 4 items. Scroll horizontally to view all items.'
    })
    const longItemRemoveButton = page.getByRole('button', {
      name: `Remove MSR ${longItemName} from comparison`
    })
    const longItemLink = page.getByRole('link', {
      name: `View MSR ${longItemName}`
    })
    const shortItemRemoveButton = page.getByRole('button', {
      name: `Remove MSR ${shortItemName} from comparison`
    })
    const [
      longItemLinkBox,
      longItemRemoveButtonBox,
      scrollRegionBox,
      shortItemRemoveButtonBox
    ] = await Promise.all([
      getElementBox(longItemLink),
      getElementBox(longItemRemoveButton),
      getElementBox(scrollRegion),
      getElementBox(shortItemRemoveButton)
    ])
    const scrollGeometry = await scrollRegion.evaluate((element) => {
      return {
        borderBoxWidth: element.getBoundingClientRect().width,
        clientWidth: element.clientWidth,
        scrollbarGutter: globalThis.getComputedStyle(element).scrollbarGutter,
        scrollWidth: element.scrollWidth
      }
    })
    const columnWidths = await getComparisonColumnWidths(table)
    const longItemLinkInlineEnd = longItemLinkBox.x + longItemLinkBox.width

    expectComparisonColumnWidths(columnWidths)
    expect(longItemRemoveButtonBox.y).toBeCloseTo(shortItemRemoveButtonBox.y, 0)
    expect(longItemLinkInlineEnd).toBeGreaterThan(longItemRemoveButtonBox.x)
    expect(scrollGeometry.scrollWidth).toBeGreaterThan(scrollGeometry.clientWidth)
    expect(scrollGeometry.borderBoxWidth - scrollGeometry.clientWidth).toBe(2)
    expect(scrollGeometry.scrollbarGutter).toBe('auto')

    await scrollRegion.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await expect.poll(
      async () => scrollRegion.evaluate((element) => element.scrollLeft)
    ).toBeGreaterThan(0)

    const lastColumnHeader = table.getByRole('columnheader').last()
    const lastColumnHeaderBox = await getElementBox(lastColumnHeader)
    const scrollRegionInlineEnd = scrollRegionBox.x + scrollRegionBox.width
    const lastColumnHeaderInlineEnd = lastColumnHeaderBox.x + lastColumnHeaderBox.width

    expect(lastColumnHeaderBox.x).toBeLessThan(scrollRegionInlineEnd)
    expect(lastColumnHeaderInlineEnd).toBeGreaterThan(scrollRegionBox.x)

    await page.evaluate(() => {
      globalThis.scrollTo(0, 0)
    })
    const scrollRegionPointerX = scrollRegionBox.x + (scrollRegionBox.width / 2)
    const scrollRegionPointerY = scrollRegionBox.y + (scrollRegionBox.height / 2)

    await page.mouse.move(scrollRegionPointerX, scrollRegionPointerY)
    const pageScrollBeforeWheel = await page.evaluate(() => globalThis.scrollY)

    expect(pageScrollBeforeWheel).toBe(0)

    await page.mouse.wheel(0, 300)

    await expect.poll(
      async () => page.evaluate(() => globalThis.scrollY)
    ).toBeGreaterThan(pageScrollBeforeWheel)
  })

  test('should keep columns stable while removing locally and restoring keyboard focus', async ({
    context,
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const tracker = await mockComparisonApi(context)
    await openComparisonPage(page, comparisonItemIds)

    const fourItemTable = page.getByRole('table', { name: 'Stoves, 4 items' })
    const fourItemRegion = fourItemTable.locator('..')
    const firstPropertyRowHeader = fourItemTable.getByRole('rowheader').first()
    const fourItemRegionBox = await getElementBox(fourItemRegion)
    const fourItemColumnWidths = await getComparisonColumnWidths(fourItemTable)
    const firstPropertyRowBox = await getElementBox(firstPropertyRowHeader)
    const reducedMotionDuration = await fourItemRegion.evaluate(
      (element) => globalThis.getComputedStyle(element).transitionDuration
    )

    expectComparisonColumnWidths(fourItemColumnWidths)
    expect(firstPropertyRowBox.width).toBeCloseTo(144, 0)
    expect(reducedMotionDuration).toBe('0s')

    const differencesCheckbox = page.getByRole('checkbox', {
      name: 'Show differences only'
    })
    await differencesCheckbox.check()

    const firstRemoveButton = page.getByRole('button', {
      name: `Remove MSR ${comparisonItems[0].name} from comparison`
    })
    await firstRemoveButton.focus()
    await firstRemoveButton.press('Enter')

    const threeItemIds = comparisonItemIds.slice(1)
    await expect(page).toHaveURL(createComparisonPath(threeItemIds))
    const threeItemTable = page.getByRole('table', { name: 'Stoves, 3 items' })

    await expect(threeItemTable).toBeVisible()
    const threeItemRegionBox = await getElementBox(threeItemTable.locator('..'))
    const threeItemColumnWidths = await getComparisonColumnWidths(threeItemTable)

    await expect(page.getByText('Loading comparison', { exact: true })).toHaveCount(0)
    await expect(differencesCheckbox).toBeChecked()
    expectComparisonColumnWidths(threeItemColumnWidths)
    expect(threeItemRegionBox.x).toBeCloseTo(fourItemRegionBox.x, 0)
    expect(tracker.comparisons).toHaveLength(1)

    const secondRemoveButton = page.getByRole('button', {
      name: `Remove MSR ${comparisonItems[1].name} from comparison`
    })
    await expect(secondRemoveButton).toBeFocused()

    const expectedCatalogSearch = buildRouteSearch([
      ['category', 'stoves'],
      ...threeItemIds.map((itemId) => ['compare', itemId] as const)
    ])
    await expect(page.getByRole('link', { name: 'Edit compared items' })).toHaveAttribute(
      'href',
      `/gear-library${expectedCatalogSearch}`
    )

    await secondRemoveButton.press('Enter')

    const twoItemIds = comparisonItemIds.slice(2)
    await expect(page).toHaveURL(createComparisonPath(twoItemIds))
    const twoItemTable = page.getByRole('table', { name: 'Stoves, 2 items' })

    await expect(twoItemTable).toBeVisible()
    const twoItemRegionBox = await getElementBox(twoItemTable.locator('..'))
    const twoItemColumnWidths = await getComparisonColumnWidths(twoItemTable)
    const twoItemColumnWidth = getFirstItemColumnWidth(twoItemColumnWidths)
    const threeItemColumnWidth = getFirstItemColumnWidth(threeItemColumnWidths)

    await expect(page.getByText('Loading comparison', { exact: true })).toHaveCount(0)
    await expect(differencesCheckbox).toBeChecked()
    expectComparisonColumnWidths(twoItemColumnWidths)
    expect(twoItemRegionBox.x).toBeCloseTo(fourItemRegionBox.x, 0)
    expect(twoItemColumnWidth).toBeCloseTo(threeItemColumnWidth, 0)
    expect(tracker.comparisons).toHaveLength(1)
    await expect(page.getByRole('button', {
      name: `Remove Primus ${comparisonItems[2].name} from comparison`
    })).toBeFocused()
  })

  test('should return to the category with one selected item after removing from a pair', async ({
    context,
    page
  }) => {
    await mockCatalogApi(context, {
      itemDetails: (request) => {
        const itemId = request.url.pathname.split('/').at(-1)

        return createComparisonCatalogItemDetail(itemId)
      }
    })
    await mockComparisonApi(context)
    const pairItemIds = comparisonItemIds.slice(0, 2)

    await openComparisonPage(page, pairItemIds)
    await page.getByRole('button', {
      name: `Remove MSR ${comparisonItems[0].name} from comparison`
    }).click()

    const catalogSearch = buildRouteSearch([
      ['category', 'stoves'],
      ['compare', comparisonItemIds[1]]
    ])

    await expect(page).toHaveURL(`/gear-library${catalogSearch}`)
    await expect(page.getByText('1 of 4 selected', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', {
      name: 'Compare',
      exact: true
    })).toBeDisabled()
    await expect(page.getByRole('button', {
      name: `Remove ${comparisonItems[1].name} from comparison`
    })).toBeVisible()
  })
})
