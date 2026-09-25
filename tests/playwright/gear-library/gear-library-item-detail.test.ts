import type { BrowserContext, Page } from '@playwright/test'
import type { ItemDetailResponse } from '#server/api/equipment/items/[id].get'
import { appBaseUrl } from '../constants.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred, getElementBox, stovesCategoryResponse } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const itemPath = `/gear-library/${itemId}`

const otherItemIds = [
  '0195f6e8-8f44-74f6-bc9a-5c8f7df477a1',
  '0195f6e8-8f44-74f6-bc9a-5c8f7df477a2',
  '0195f6e8-8f44-74f6-bc9a-5c8f7df477a3',
  '0195f6e8-8f44-74f6-bc9a-5c8f7df477a4'
]

const itemSummary = {
  id: itemId,
  isInMyGear: false,
  name: 'PocketRocket Deluxe',
  cloudflareImageId: null,

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
  }]
}

const itemDetail = {
  id: itemId,
  isInMyGear: false,
  name: 'PocketRocket Deluxe',
  cloudflareImageId: null,
  createdAt: '2026-04-01T09:00:00.000Z',

  brand: {
    id: 1,
    name: 'MSR',
    slug: 'msr'
  },

  category: {
    id: 2,
    name: 'Stoves',
    slug: 'stoves'
  },

  properties: [
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g',
      value: 83
    },
    {
      dataType: 'boolean',
      name: 'Piezo ignition',
      slug: 'piezo',
      unit: null,
      value: false
    },
    {
      dataType: 'number',
      name: 'Packed weight',
      slug: 'packed-weight',
      unit: 'g',
      value: 0
    },
    {
      dataType: 'enum',
      enumOptionName: 'Canister',
      name: 'Fuel type',
      slug: 'fuel',
      unit: null,
      value: 'canister'
    },
    {
      dataType: 'text',
      name: 'Notes',
      slug: 'notes',
      unit: null,
      value: null
    }
  ]
} satisfies ItemDetailResponse

async function mockCatalog(context: BrowserContext) {
  await context.route(/\/api\/equipment\/items(?:\?.*)?$/u, async (route) => {
    await route.fulfill({
      json: {
        items: [itemSummary],
        limit: 10,
        page: 1,
        total: 1
      }
    })
  })

  await context.route('**/api/equipment/categories**', async (route) => {
    await route.fulfill({
      json: [{
        id: 2,
        name: 'Stoves',
        slug: 'stoves'
      }]
    })
  })

  await context.route('**/api/equipment/categories/by-slug/stoves', async (route) => {
    await route.fulfill({ json: stovesCategoryResponse })
  })

  await context.route('**/api/equipment/brands**', async (route) => {
    await route.fulfill({ json: [] })
  })
}

async function mockItemDetail(context: BrowserContext, name = itemDetail.name) {
  await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
    const id = new globalThis.URL(route.request().url()).pathname.split('/').at(-1)

    if (id !== itemId) {
      await route.fulfill({
        status: 404,
        json: { message: 'Missing item' }
      })

      return
    }

    await route.fulfill({
      json: {
        ...itemDetail,
        name
      }
    })
  })
}

async function signInGuest(context: BrowserContext, page: Page, redirectTo: string) {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        isGuest: true,
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })

  const loginUrl = new globalThis.URL('/login', appBaseUrl)

  loginUrl.searchParams.set('redirectTo', redirectTo)
  await page.goto(loginUrl.href)
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: 'Guest' }).click()
}

test.describe('Gear library item detail', () => {
  test('shows the selected layout and returns to the same catalog selection', async ({ context, page }) => {
    const submitPhotoLink = page.getByRole('link', {
      name: 'Submit photo',
      includeHidden: true
    })

    await test.step('Open the selected catalog item', async () => {
      await mockCatalog(context)
      await mockItemDetail(context)
      await signInGuest(context, page, '/gear-library?category=stoves&q=Pocket&compare=0195f6e8-8f44-74f6-bc9a-5c8f7df477d7')

      const detailLink = page.getByRole('link', { name: itemSummary.name })
      const detailHref = await detailLink.getAttribute('href')

      expect(detailHref).not.toBeNull()

      const detailHrefValue = String(detailHref)
      const detailUrl = new globalThis.URL(detailHrefValue, appBaseUrl)

      expect(detailUrl.pathname).toBe(itemPath)
      expect(detailUrl.searchParams.get('category')).toBe('stoves')
      expect(detailUrl.searchParams.get('q')).toBe('Pocket')
      expect(detailUrl.searchParams.get('compare')).toBe(itemId)
      await detailLink.click()
    })

    await test.step('Read item data and available actions', async () => {
      await expect(page).toHaveTitle('PocketRocket Deluxe — MSR | Perd')
      await expect(page.getByRole('main')).toHaveCount(1)

      await expect(page.getByRole('heading', {
        level: 1,
        name: itemSummary.name
      })).toBeVisible()

      await expect(page.getByText('MSR')).toBeVisible()
      await expect(page.getByText('Stoves')).toBeVisible()
      await expect(page.getByRole('img', { name: itemSummary.name })).toBeVisible()

      await expect(page.getByRole('heading', {
        level: 2,
        name: 'Characteristics'
      })).toBeVisible()

      await expect(page.locator('dl > div')).toContainText([
        'Weight83 g',
        'Piezo ignitionNo',
        'Packed weight0 g',
        'Fuel typeCanister',
        'NotesNot set'
      ])

      await expect(page.getByRole('link', { name: 'View comparison selection' })).toBeVisible()
    })

    await test.step('Open photo submission and return with catalog state', async () => {
      await expect(submitPhotoLink).toBeHidden()
      await page.getByText('More', { exact: true }).click()
      await expect(submitPhotoLink).toBeVisible()

      const submitPhotoHref = await submitPhotoLink.getAttribute('href')

      expect(submitPhotoHref).not.toBeNull()

      const submitPhotoHrefValue = String(submitPhotoHref)
      const submitPhotoUrl = new globalThis.URL(submitPhotoHrefValue, appBaseUrl)

      expect(submitPhotoUrl.pathname).toBe(`${itemPath}/submit-photo`)
      expect(submitPhotoUrl.searchParams.get('category')).toBe('stoves')
      expect(submitPhotoUrl.searchParams.get('q')).toBe('Pocket')
      expect(submitPhotoUrl.searchParams.get('compare')).toBe(itemId)
      await submitPhotoLink.click()

      const backToItem = page.getByRole('link', { name: `Back to ${itemSummary.name}` })
      const backToItemHref = await backToItem.getAttribute('href')

      expect(backToItemHref).not.toBeNull()

      const backToItemHrefValue = String(backToItemHref)
      const backToItemUrl = new globalThis.URL(backToItemHrefValue, appBaseUrl)

      expect(backToItemUrl.pathname).toBe(itemPath)
      expect(backToItemUrl.searchParams.get('category')).toBe('stoves')
      expect(backToItemUrl.searchParams.get('q')).toBe('Pocket')
      expect(backToItemUrl.searchParams.get('compare')).toBe(itemId)
      await backToItem.click()

      await expect(page.getByRole('heading', {
        level: 1,
        name: itemSummary.name
      })).toBeVisible()

      await page.getByText('More', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(submitPhotoLink).toBeHidden()
      await expect(page.getByRole('link', { name: 'Manage images' })).toHaveCount(0)
    })

    await test.step('Keep actions and content usable on narrow and wide screens', async () => {
      const addButton = page.getByRole('button', { name: 'Add to My gear PocketRocket Deluxe' })
      const compareButton = page.getByRole('link', { name: 'View comparison selection' })

      await page.setViewportSize({
        width: 390,
        height: 844
      })

      const mobileAddBox = await getElementBox(addButton)
      const mobileCompareBox = await getElementBox(compareButton)

      expect(mobileCompareBox.y).toBeGreaterThan(mobileAddBox.y + mobileAddBox.height - 2)

      const mobileActionOffset = Math.abs(mobileCompareBox.x - mobileAddBox.x)

      expect(mobileActionOffset).toBeLessThan(2)
      expect(mobileAddBox.x + mobileAddBox.width).toBeLessThanOrEqual(390)
      expect(mobileCompareBox.x + mobileCompareBox.width).toBeLessThanOrEqual(390)

      await page.setViewportSize({
        width: 1280,
        height: 900
      })

      const desktopAddBox = await getElementBox(addButton)
      const desktopCompareBox = await getElementBox(compareButton)
      const desktopImage = page.getByRole('img', { name: itemSummary.name })
      const desktopImageBox = await getElementBox(desktopImage)

      const specificationsHeading = page.getByRole('heading', {
        level: 2,
        name: 'Characteristics'
      })

      const desktopSpecificationsBox = await getElementBox(specificationsHeading)
      const desktopActionOffset = Math.abs(desktopCompareBox.y - desktopAddBox.y)

      expect(desktopActionOffset).toBeLessThan(2)
      expect(desktopImageBox.x).toBeGreaterThan(desktopSpecificationsBox.x)
      expect(desktopImageBox.y).toBeLessThan(desktopSpecificationsBox.y + 48)
      expect(desktopImageBox.height).toBeLessThanOrEqual(320)
      expect(desktopSpecificationsBox.y).toBeLessThan(450)
    })

    await test.step('Return to the same catalog selection', async () => {
      await page.getByRole('link', { name: 'Back to gear library' }).click()
      await expect(page).toHaveURL(/\/gear-library\?/u)

      const backUrl = new globalThis.URL(page.url())

      expect(backUrl.searchParams.get('category')).toBe('stoves')
      expect(backUrl.searchParams.get('q')).toBe('Pocket')
      expect(backUrl.searchParams.get('compare')).toBe(itemId)
    })
  })

  test('keeps long item names and actions inside a narrow viewport', async ({ context, page }) => {
    const longName = 'PocketRocketDeluxeWithAnUnbrokenProductNameThatMustWrapInsideTheCard'

    await mockItemDetail(context, longName)
    await signInGuest(context, page, itemPath)

    await page.setViewportSize({
      width: 320,
      height: 700
    })

    const title = page.getByRole('heading', {
      level: 1,
      name: longName
    })

    const addButton = page.getByRole('button', { name: `Add to My gear ${longName}` })
    const comparisonButton = page.getByRole('button', { name: 'Add to comparison' })

    await expect(title).toBeVisible()
    await expect(addButton).toBeVisible()
    await expect(comparisonButton).toBeVisible()

    const viewportWidth = 320

    await Promise.all([title, addButton, comparisonButton].map(async (element) => {
      const box = await getElementBox(element)

      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth)
    }))

    const documentWidth = await page.evaluate(() => globalThis.document.documentElement.scrollWidth)

    expect(documentWidth).toBeLessThanOrEqual(viewportWidth)
  })

  test('keeps My gear available after a failed save and supports keyboard retry', async ({ context, page }) => {
    await mockItemDetail(context)

    let saveAttempts = 0

    let saveResponse: { status: number; json: unknown; } = {
      status: 500,
      json: { message: 'Private failure' }
    }

    await context.route('**/api/user/gear', async (route) => {
      saveAttempts += 1

      await route.fulfill(saveResponse)
    })

    await signInGuest(context, page, itemPath)

    await page.setViewportSize({
      width: 390,
      height: 844
    })

    const addButton = page.getByRole('button', { name: 'Add to My gear PocketRocket Deluxe' })

    await expect(addButton).toBeVisible()

    const addButtonBox = await getElementBox(addButton)
    const addScrollY = await page.evaluate(() => globalThis.scrollY)
    const addDocumentY = addButtonBox.y + addScrollY

    await addButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Could not add', { exact: true })).toBeVisible()
    await expect(addButton).toBeFocused()

    saveResponse = {
      status: 201,
      json: {}
    }

    await page.keyboard.press('Enter')

    const savedStatus = page.getByText('In My gear', { exact: true })

    await expect(savedStatus).toBeVisible()
    await expect(addButton).toHaveCount(0)

    const savedStatusBox = await getElementBox(savedStatus)
    const savedScrollY = await page.evaluate(() => globalThis.scrollY)
    const savedDocumentY = savedStatusBox.y + savedScrollY
    const savedHorizontalOffset = Math.abs(savedStatusBox.x - addButtonBox.x)

    expect(savedHorizontalOffset).toBeLessThan(2)

    const savedWidthDifference = Math.abs(savedStatusBox.width - addButtonBox.width)

    expect(savedWidthDifference).toBeLessThan(2)

    const savedHeightDifference = Math.abs(savedStatusBox.height - addButtonBox.height)

    expect(savedHeightDifference).toBeLessThan(2)

    const savedVerticalOffset = Math.abs(savedDocumentY - addDocumentY)

    expect(savedVerticalOffset).toBeLessThan(2)
    expect(saveAttempts).toBe(2)
  })

  test('adds the item to comparison and resets filters from another category', async ({ context, page }) => {
    await mockCatalog(context)
    await mockItemDetail(context)

    const detailUrl = new globalThis.URL(itemPath, appBaseUrl)

    detailUrl.searchParams.set('category', 'tents')
    detailUrl.searchParams.set('compare', otherItemIds[0])
    detailUrl.searchParams.set('number', 'weight:10:20')
    await signInGuest(context, page, detailUrl.pathname + detailUrl.search)
    await page.getByRole('button', { name: 'Add to comparison' }).click()
    await expect(page).toHaveURL(/\/gear-library\?/u)

    const catalogUrl = new globalThis.URL(page.url())

    expect(catalogUrl.searchParams.get('category')).toBe('stoves')
    expect(catalogUrl.searchParams.getAll('compare')).toStrictEqual([itemId])
    expect(catalogUrl.searchParams.has('number')).toBe(false)
  })

  test('keeps four selected items and explains the comparison limit', async ({ context, page }) => {
    await mockCatalog(context)
    await mockItemDetail(context)

    const detailUrl = new globalThis.URL(itemPath, appBaseUrl)

    detailUrl.searchParams.set('category', 'stoves')

    const selectedItemMocks = otherItemIds.map(async (id) => {
      detailUrl.searchParams.append('compare', id)

      const name = `Selected item ${id}`

      const selectedItem = {
        ...itemDetail,
        id,
        name
      } satisfies ItemDetailResponse

      await context.route(`**/api/equipment/items/${id}`, async (route) => {
        await route.fulfill({ json: selectedItem })
      })
    })

    await Promise.all(selectedItemMocks)
    await signInGuest(context, page, detailUrl.pathname + detailUrl.search)
    await expect(page.getByText('You can compare up to 4 items. Remove one to add this item.')).toBeVisible()
    await page.getByRole('link', { name: 'Edit comparison' }).click()
    await expect(page).toHaveURL(/\/gear-library\?/u)

    const restoredSelections = otherItemIds.map(async (id) => {
      const removeLabel = `Remove Selected item ${id} from comparison`

      await expect(page.getByRole('button', { name: removeLabel })).toBeVisible()
    })

    await Promise.all(restoredSelections)

    const catalogUrl = new globalThis.URL(page.url())

    expect(catalogUrl.searchParams.getAll('compare')).toStrictEqual(otherItemIds)
  })

  test('shows a missing item without a retry action', async ({ context, page }) => {
    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      await route.fulfill({
        status: 404,
        json: { message: 'Missing item' }
      })
    })

    await signInGuest(context, page, itemPath)
    await expect(page.getByRole('heading', { name: 'Item unavailable.' })).toBeVisible()
    await expect(page).toHaveTitle('Item unavailable. | Perd')
    await expect(page.getByRole('status')).toHaveText('Item unavailable. This item is not available in the gear library.')
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Submit photo' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back to gear library' })).toBeVisible()
  })

  test('retries a temporary item error and replaces it with the item', async ({ context, page }) => {
    const retryGate = createDeferred()
    let itemRequests = 0

    let itemRouteResponse: { status: number; json: unknown; } = {
      status: 500,
      json: { message: 'Private failure' }
    }

    let responseGate = Promise.resolve()

    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      itemRequests += 1

      await responseGate

      await route.fulfill(itemRouteResponse)
    })

    await signInGuest(context, page, itemPath)
    await expect(page.getByRole('heading', { name: 'Could not load item.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Submit photo' })).toHaveCount(0)

    const requestsBeforeRetry = itemRequests

    itemRouteResponse = {
      status: 200,
      json: itemDetail
    }
    responseGate = retryGate.promise

    const retryButton = page.getByRole('button', { name: 'Retry' })

    await retryButton.focus()
    await page.keyboard.press('Enter')
    await expect(retryButton).toBeFocused()
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    retryGate.resolve()

    await expect(page.getByRole('heading', {
      level: 1,
      name: itemSummary.name
    })).toBeVisible()

    await expect(page.getByRole('heading', {
      level: 1,
      name: itemSummary.name
    })).toBeFocused()

    expect(itemRequests).toBeGreaterThan(requestsBeforeRetry)
  })

  test('keeps focus after a failed retry and blocks repeated activation while pending', async ({ context, page }) => {
    const retryGate = createDeferred()
    let responseGate = Promise.resolve()
    let itemRequests = 0

    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      itemRequests += 1
      await responseGate

      await route.fulfill({
        status: 500,
        json: { message: 'Private failure' }
      })
    })

    await signInGuest(context, page, itemPath)

    const retryButton = page.getByRole('button', { name: 'Retry' })
    const loadStatus = page.getByRole('status')

    await expect(retryButton).toBeVisible()
    await expect(loadStatus).toHaveText('Could not load item. The equipment item could not be loaded. Try again.')

    const requestsBeforeRetry = itemRequests
    const expectedPendingRequests = requestsBeforeRetry + 1

    responseGate = retryGate.promise

    await retryButton.focus()
    await page.keyboard.press('Enter')
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    await expect(retryButton).toHaveAttribute('aria-disabled', 'true')
    await expect(retryButton).not.toHaveAttribute('disabled')
    await expect(retryButton).toBeFocused()
    await expect(loadStatus).toHaveText('Retrying equipment item.')
    await expect.poll(() => itemRequests).toBe(expectedPendingRequests)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    expect(itemRequests).toBe(expectedPendingRequests)
    retryGate.resolve()
    await expect(retryButton).not.toHaveAttribute('aria-busy')
    await expect(retryButton).toBeEnabled()
    await expect(retryButton).toBeFocused()
    await expect(loadStatus).toHaveText('Could not load item. The equipment item could not be loaded. Try again.')
  })

  test('does not steal focus when the user leaves Retry before success', async ({ context, page }) => {
    const retryGate = createDeferred()
    let responseGate = Promise.resolve()

    let itemRouteResponse: { status: number; json: unknown; } = {
      status: 500,
      json: { message: 'Private failure' }
    }

    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      await responseGate

      await route.fulfill(itemRouteResponse)
    })

    await signInGuest(context, page, itemPath)

    const retryButton = page.getByRole('button', { name: 'Retry' })
    const backLink = page.getByRole('link', { name: 'Back to gear library' })

    await expect(retryButton).toBeVisible()

    itemRouteResponse = {
      status: 200,
      json: itemDetail
    }
    responseGate = retryGate.promise

    await retryButton.focus()
    await page.keyboard.press('Enter')
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    await backLink.focus()
    retryGate.resolve()

    await expect(page.getByRole('heading', {
      level: 1,
      name: itemDetail.name
    })).toBeVisible()

    await expect(backLink).toBeFocused()
  })

  test('shows a loading state during a pending detail request', async ({ context, page }) => {
    await mockCatalog(context)

    const releaseRequest = createDeferred()

    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      await releaseRequest.promise

      await route.fulfill({ json: itemDetail })
    })

    await signInGuest(context, page, '/gear-library')

    const navigation = page.getByRole('link', { name: itemSummary.name }).click()

    await expect(page.getByRole('heading', { name: 'Loading equipment item' })).toBeVisible()
    releaseRequest.resolve()

    await navigation

    await expect(page.getByRole('heading', {
      level: 1,
      name: itemSummary.name
    })).toBeVisible()
  })

  test('shows image management to admins', async ({ context, page }) => {
    await mockItemDetail(context)

    await mockTwitchSignIn(context, page, {
      redirectTo: itemPath,

      user: {
        email: null,
        isAdmin: true,
        isGuest: false,
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })

    await expect(page).toHaveURL(/\/gear-library\/0195f6e8-8f44-74f6-bc9a-5c8f7df477d7$/u)
    await page.getByText('More', { exact: true }).click()

    await expect(page.getByRole('link', { name: 'Manage images' })).toHaveAttribute(
      'href',
      '/admin/equipment/items/0195f6e8-8f44-74f6-bc9a-5c8f7df477d7/images'
    )
  })
})
