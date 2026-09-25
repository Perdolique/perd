import type { BrowserContext, Page } from '@playwright/test'
import { appBaseUrl } from '../constants.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred, getElementBox, stovesCategoryResponse } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const itemPath = '/gear-library/0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

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
  ...itemSummary,
  createdAt: '2026-04-01T09:00:00.000Z',

  brand: {
    id: 1,
    ...itemSummary.brand
  },

  category: {
    id: 2,
    ...itemSummary.category
  },

  properties: [
    itemSummary.properties[0],
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
}

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

async function mockItemDetail(context: BrowserContext) {
  await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
    const id = new globalThis.URL(route.request().url()).pathname.split('/').at(-1)

    await route.fulfill({
      json: {
        ...itemDetail,
        id
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
    await mockCatalog(context)
    await mockItemDetail(context)
    await signInGuest(context, page, '/gear-library?category=stoves&q=Pocket&compare=0195f6e8-8f44-74f6-bc9a-5c8f7df477d7')

    const detailLink = page.getByRole('link', { name: itemSummary.name })
    const detailHref = await detailLink.getAttribute('href')

    expect(detailHref).not.toBeNull()

    const detailUrl = new globalThis.URL(String(detailHref), appBaseUrl)

    expect(detailUrl.pathname).toBe(itemPath)
    expect(detailUrl.searchParams.get('category')).toBe('stoves')
    expect(detailUrl.searchParams.get('q')).toBe('Pocket')
    expect(detailUrl.searchParams.get('compare')).toBe(itemId)
    await detailLink.click()

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

    await expect(page.getByRole('button', { name: 'View comparison selection' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Submit photo' })).toHaveAttribute(
      'href',
      '/gear-library/0195f6e8-8f44-74f6-bc9a-5c8f7df477d7/submit-photo'
    )

    await expect(page.getByRole('link', { name: 'Manage images' })).toHaveCount(0)

    const addButton = page.getByRole('button', { name: 'Add to My gear PocketRocket Deluxe' })
    const compareButton = page.getByRole('button', { name: 'View comparison selection' })

    await page.setViewportSize({
      width: 390,
      height: 844
    })

    const mobileAddBox = await getElementBox(addButton)
    const mobileCompareBox = await getElementBox(compareButton)

    expect(mobileCompareBox.y).toBeGreaterThan(mobileAddBox.y + mobileAddBox.height - 2)
    expect(Math.abs(mobileCompareBox.x - mobileAddBox.x)).toBeLessThan(2)

    await page.setViewportSize({
      width: 1280,
      height: 900
    })

    const desktopAddBox = await getElementBox(addButton)
    const desktopCompareBox = await getElementBox(compareButton)

    expect(Math.abs(desktopCompareBox.y - desktopAddBox.y)).toBeLessThan(2)
    await page.getByRole('link', { name: 'Back to gear library' }).click()
    await expect(page).toHaveURL(/\/gear-library\?/u)

    const backUrl = new globalThis.URL(page.url())

    expect(backUrl.searchParams.get('category')).toBe('stoves')
    expect(backUrl.searchParams.get('q')).toBe('Pocket')
    expect(backUrl.searchParams.get('compare')).toBe(itemId)
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

    const addButton = page.getByRole('button', { name: 'Add to My gear PocketRocket Deluxe' })

    await expect(addButton).toBeVisible()
    await addButton.click()
    await expect(page.getByText('Could not add', { exact: true })).toBeVisible()

    saveResponse = {
      status: 201,
      json: {}
    }

    await addButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('In My gear')).toBeVisible()
    await expect(addButton).toHaveCount(0)
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

    for (const id of otherItemIds) {
      detailUrl.searchParams.append('compare', id)
    }

    await signInGuest(context, page, detailUrl.pathname + detailUrl.search)
    await expect(page.getByText('You can compare up to 4 items. Remove one to add this item.')).toBeVisible()
    await page.getByRole('button', { name: 'Edit comparison' }).click()
    await expect(page).toHaveURL(/\/gear-library\?/u)

    const catalogUrl = new globalThis.URL(page.url())

    expect(catalogUrl.searchParams.getAll('compare')).toStrictEqual(otherItemIds)
    expect(catalogUrl.searchParams.getAll('compare')).not.toContain(itemId)
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
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Submit photo' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back to gear library' })).toBeVisible()
  })

  test('retries a temporary item error and replaces it with the item', async ({ context, page }) => {
    let itemRequests = 0

    let itemRouteResponse: { status: number; json: unknown; } = {
      status: 500,
      json: { message: 'Private failure' }
    }

    await context.route(/\/api\/equipment\/items\/[0-9a-f-]+(?:\?.*)?$/u, async (route) => {
      itemRequests += 1

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

    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('heading', {
      level: 1,
      name: itemSummary.name
    })).toBeVisible()

    expect(itemRequests).toBeGreaterThan(requestsBeforeRetry)
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

    await expect(page.getByRole('link', { name: 'Manage images' })).toHaveAttribute(
      'href',
      '/admin/equipment/items/0195f6e8-8f44-74f6-bc9a-5c8f7df477d7/images'
    )
  })
})
