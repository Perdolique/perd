import type { Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  createDeferred,
  firstPageResponse,
  getElementBox,
  getGearLibrarySelect,
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  selectPerdOption,
  serverErrorResponse,
  sleepingPadItem,
  stoveItem
} from '../fixtures/gear-library-entry-list.fixtures.ts'

interface MyGearMockResponse {
  json: object;
  status?: number;
}

function createMyGearRow(item = stoveItem) {
  return {
    createdAt: '2026-07-23T00:00:00.000Z',
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab',
    item: {
      brand: item.brand,
      category: item.category,
      id: item.id,
      name: item.name
    }
  }
}

function respondWithSelectedCategoryItems(request: {
  url: InstanceType<typeof globalThis.URL>;
}) {
  const selectedCategory = request.url.searchParams.get('categorySlug')

  if (selectedCategory === 'stoves') {
    return {
      json: {
        items: [stoveItem],
        limit: 10,
        page: 1,
        total: 1
      }
    }
  }

  return { json: firstPageResponse }
}

function isMyGearCreateRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/user/gear' && request.method() === 'POST'
}

function createRecoveringMyGearResponder() {
  const state: { response: MyGearMockResponse } = {
    response: serverErrorResponse
  }

  return {
    respond: () => state.response,
    succeed: () => {
      state.response = { json: [createMyGearRow()] }
    }
  }
}

function createRetryingMyGearResponder() {
  let requestCount = 0

  return () => {
    requestCount += 1

    if (requestCount === 1) {
      return serverErrorResponse
    }

    return {
      status: 409,
      json: { statusCode: 409 }
    }
  }
}

function createIndependentMyGearResponder(firstAdditionGate: Promise<void>) {
  return (request: Request) => {
    const requestBody: unknown = request.postDataJSON()
    const isFirstItem = typeof requestBody === 'object'
      && requestBody !== null
      && 'itemId' in requestBody
      && requestBody.itemId === stoveItem.id
    const responseItem = isFirstItem ? stoveItem : sleepingPadItem
    const waitFor = isFirstItem ? firstAdditionGate : undefined

    return {
      status: 201,
      json: createMyGearRow(responseItem),
      waitFor
    }
  }
}

test.describe('Gear library item actions', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should add an item without opening details and swap actions in comparison mode', async ({
    context,
    page
  }) => {
    await mockCatalogApi(context, {
      items: respondWithSelectedCategoryItems
    })
    await openGearLibrary(page)

    const addButtonName = `Add to My gear ${stoveItem.name}`
    const addButton = page.getByRole('button', { name: addButtonName })
    const stoveRow = page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: stoveItem.name })
    })
    const weightLabel = stoveRow.getByText('Weight', { exact: true })
    const actionRailBefore = addButton.locator('..')
    const actionRailBoxBefore = await getElementBox(actionRailBefore)
    const weightBoxBefore = await getElementBox(weightLabel)
    const createRequestPromise = page.waitForRequest(isMyGearCreateRequest)

    await addButton.click()

    const createRequest = await createRequestPromise
    const requestBody: unknown = createRequest.postDataJSON()

    expect(requestBody).toStrictEqual({ itemId: stoveItem.id })
    await expect(page).toHaveURL(/\/gear-library$/u)

    const savedStatus = stoveRow.getByText('In My gear')

    await expect(savedStatus).toBeVisible()
    await expect(stoveRow.getByRole('button', { name: addButtonName })).toHaveCount(0)

    const actionRailBoxAfter = await getElementBox(savedStatus.locator('..'))
    const weightBoxAfter = await getElementBox(weightLabel)

    expect(actionRailBoxAfter.width).toBeCloseTo(actionRailBoxBefore.width, 0)
    expect(weightBoxAfter.x).toBeCloseTo(weightBoxBefore.x, 0)

    await savedStatus.click()
    await expect(page).toHaveURL(/\/gear-library$/u)
    await expect(page.getByRole('button', { name: 'Compare items' })).toHaveCount(0)

    await selectPerdOption(getGearLibrarySelect(page, 'Category'), 'stoves')

    const compareModeButton = page.getByRole('button', { name: 'Compare items' })

    await expect(compareModeButton).toBeVisible()
    await compareModeButton.click()

    const comparisonTray = page.getByTestId('gear-library-comparison-tray')

    await expect(comparisonTray.getByText('0 of 4 selected')).toBeVisible()
    await expect(comparisonTray.getByText('Select 2 to 4 items')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Add to My gear /u })).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: /^Select /u })).toHaveCount(1)

    const firstSelectionControl = page.getByRole('checkbox', { name: /^Select /u }).first().locator('..')
    const selectionControlBox = await getElementBox(firstSelectionControl)

    expect(selectionControlBox.width).toBeCloseTo(actionRailBoxBefore.width, 0)
    await expect(firstSelectionControl).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(firstSelectionControl).toHaveCSS('border-left-width', '1px')

    const unselectedBackground = await firstSelectionControl.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )
    const firstSelectionCheckbox = firstSelectionControl.getByRole('checkbox')

    await firstSelectionCheckbox.check()
    await expect(comparisonTray.getByText('1 of 4 selected')).toBeVisible()

    const selectedBackground = await firstSelectionControl.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )

    expect(selectedBackground).not.toBe(unselectedBackground)

    await page.setViewportSize({
      height: 844,
      width: 390
    })
    await expect.poll(async () => page.evaluate(() => globalThis.innerWidth)).toBe(390)

    const cardBottomLeftRadius = await stoveRow.evaluate(
      (element) => globalThis.getComputedStyle(element).borderBottomLeftRadius
    )
    const cardBottomRightRadius = await stoveRow.evaluate(
      (element) => globalThis.getComputedStyle(element).borderBottomRightRadius
    )

    await expect(firstSelectionControl).toHaveCSS('border-bottom-left-radius', cardBottomLeftRadius)
    await expect(firstSelectionControl).toHaveCSS('border-bottom-right-radius', cardBottomRightRadius)

    await page.getByRole('button', { name: 'Cancel comparison' }).click()

    await expect(comparisonTray).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: /^Select /u })).toHaveCount(0)
    await expect(stoveRow.getByText('In My gear')).toBeVisible()
  })

  test('should render saved status from My Gear and recover a failed initial status request', async ({
    context,
    page
  }) => {
    const myGearResponder = createRecoveringMyGearResponder()

    await mockCatalogApi(context, {
      myGear: myGearResponder.respond
    })
    await openGearLibrary(page)

    await expect(page.getByText(
      'My gear status unavailable. You can still add items.'
    )).toBeVisible()

    myGearResponder.succeed()

    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByText(
      'My gear status unavailable. You can still add items.'
    )).toHaveCount(0)
    await expect(page.getByText('In My gear', { exact: true })).toBeVisible()
  })

  test('should keep a failed addition retryable and treat a duplicate as saved', async ({
    context,
    page
  }) => {
    await mockCatalogApi(context, {
      addMyGear: createRetryingMyGearResponder()
    })
    await openGearLibrary(page)

    const addButton = page.getByRole('button', {
      name: `Add to My gear ${stoveItem.name}`
    })

    await addButton.click()

    await expect(page.getByText('Could not add', { exact: true })).toBeVisible()
    await expect(addButton).toBeEnabled()

    await addButton.click()

    await expect(page.getByText('In My gear', { exact: true })).toBeVisible()
    await expect(page.getByText('Could not add', { exact: true })).toHaveCount(0)
  })

  test('should keep item additions independent while another item is saving', async ({
    context,
    page
  }) => {
    const firstAdditionGate = createDeferred()

    await mockCatalogApi(context, {
      addMyGear: createIndependentMyGearResponder(firstAdditionGate.promise),

      items: () => {
        return { json: firstPageResponse }
      }
    })
    await openGearLibrary(page)

    const firstAddButton = page.getByRole('button', {
      name: `Add to My gear ${stoveItem.name}`
    })
    const secondAddButton = page.getByRole('button', {
      name: `Add to My gear ${sleepingPadItem.name}`
    })

    await firstAddButton.click()
    await expect(firstAddButton).toBeDisabled()
    await expect(secondAddButton).toBeEnabled()

    await secondAddButton.click()
    await expect(page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: sleepingPadItem.name })
    }).getByText('In My gear')).toBeVisible()

    firstAdditionGate.resolve()
    await expect(page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: stoveItem.name })
    }).getByText('In My gear')).toBeVisible()
  })
})
