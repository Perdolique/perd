import type { BrowserContext, Page } from '@playwright/test'
import type { ItemDetailResponse } from '#server/api/equipment/items/[id].get'
import type { EquipmentItemGalleryImage } from '#server/api/equipment/items/[id]/gallery.get'
import { expect, test } from '../fixtures/global.fixtures.ts'

import {
  createDeferred,
  getElementBox,
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  sleepingPadItem,
  stoveItem
} from '../fixtures/gear-library-entry-list.fixtures.ts'

const galleryPath = `/api/equipment/items/${stoveItem.id}/gallery`
const galleryName = `Photos of ${stoveItem.name}`
const imageBody = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="green"/></svg>'
const placeholderPath = '/equipment-item-placeholder.webp'

const smallGalleryCases = [{
  alt: '',
  count: 0,
  source: placeholderPath,
  status: 'No photos yet.'
}, {
  alt: stoveItem.name,
  count: 1,
  source: /\/gallery-primary\//u,
  status: ''
}]

const galleryImages = [{
  cloudflareImageId: 'gallery-primary',
  displayOrder: 0,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
}, {
  cloudflareImageId: 'gallery-second',
  displayOrder: 1,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'
}, {
  cloudflareImageId: 'gallery-third',
  displayOrder: 2,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3'
}, {
  cloudflareImageId: 'gallery-fourth',
  displayOrder: 3,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e4'
}, {
  cloudflareImageId: 'gallery-fifth',
  displayOrder: 4,
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e5'
}] as const satisfies readonly EquipmentItemGalleryImage[]

async function mockGallery(context: BrowserContext, images: readonly EquipmentItemGalleryImage[] = galleryImages) {
  const detail: ItemDetailResponse = {
    brand: {
      id: 1,
      ...stoveItem.brand
    },

    category: {
      id: 2,
      ...stoveItem.category
    },

    cloudflareImageId: images[0]?.cloudflareImageId ?? null,
    createdAt: '2026-10-01T12:00:00.000Z',
    id: stoveItem.id,
    isInMyGear: false,
    name: stoveItem.name,
    properties: stoveItem.properties
  }

  return mockCatalogApi(context, {
    itemDetails: (request) => {
      if (request.url.pathname.endsWith(stoveItem.id)) {
        return { json: detail }
      }

      return {
        json: {
          ...detail,
          cloudflareImageId: null,
          id: sleepingPadItem.id,
          name: sleepingPadItem.name
        }
      }
    },

    itemGalleries: (request) => {
      const isStoveGallery = request.url.pathname === galleryPath
      const responseImages = isStoveGallery ? images : []

      return { json: responseImages }
    }
  })
}

async function openItem(page: Page) {
  await openGearLibrary(page)

  await page.getByRole('link', {
    name: stoveItem.name,
    exact: true
  }).click()

  await expect(page.getByRole('heading', {
    name: stoveItem.name,
    exact: true
  })).toBeVisible()
}

async function mockGalleryRetry(context: BrowserContext) {
  const gate = createDeferred()

  const state = {
    requestCount: 0,
    shouldFail: true
  }

  await mockGallery(context)

  await context.route(galleryPath, async (route) => {
    state.requestCount += 1

    if (state.shouldFail) {
      await route.fulfill({
        status: 400,
        json: { message: 'Private failure details' }
      })

      return
    }

    await gate.promise

    await route.fulfill({ json: galleryImages })
  })

  return {
    gate,
    state
  }
}

async function mockImageRetry(context: BrowserContext) {
  const gate = createDeferred()

  const state = {
    requestCount: 0,
    shouldFail: true
  }

  await mockGallery(context)

  await context.route('https://imagedelivery.net/*/gallery-second/*fit=scale-down', async (route) => {
    state.requestCount += 1

    if (state.shouldFail) {
      await route.abort('failed')

      return
    }

    await gate.promise

    await route.fulfill({
      body: imageBody,
      contentType: 'image/svg+xml'
    })
  })

  return {
    gate,
    state
  }
}

test.describe('Published equipment gallery', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)

    await context.route('https://imagedelivery.net/**', async (route) => {
      await route.fulfill({
        body: imageBody,
        contentType: 'image/svg+xml'
      })
    })
  })

  for (const galleryCase of smallGalleryCases) {
    test(`shows ${galleryCase.count} photos without selection controls`, async ({ context, page }) => {
      const images = galleryImages.slice(0, galleryCase.count)

      await mockGallery(context, images)
      await openItem(page)

      const gallery = page.getByRole('region', { name: galleryName })
      const image = gallery.locator('img')

      await expect(gallery.getByText('Loading photos.')).toHaveCount(0)
      await expect(gallery.getByRole('button')).toHaveCount(0)
      await expect(gallery.getByRole('status')).toHaveText(galleryCase.status)
      await expect(image).toHaveAttribute('src', galleryCase.source)
      await expect(image).toHaveAttribute('alt', galleryCase.alt)
      await expect.poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    })
  }

  for (const width of [320, 1280]) {
    test(`selects ordered photos with pointer and keyboard at ${width}px`, async ({ context, page }) => {
      await page.setViewportSize({
        width,
        height: 900
      })

      await mockGallery(context)
      await openItem(page)

      const gallery = page.getByRole('region', { name: galleryName })
      const image = gallery.getByRole('img', { name: stoveItem.name })
      const firstButton = gallery.getByRole('button', { name: 'View photo 1 of 5' })
      const secondButton = gallery.getByRole('button', { name: 'View photo 2 of 5' })
      const lastButton = gallery.getByRole('button', { name: 'View photo 5 of 5' })

      await expect(firstButton).toHaveAttribute('aria-pressed', 'true')
      await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 5')
      await firstButton.focus()
      await page.keyboard.press('Tab')
      await expect(secondButton).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(secondButton).toBeFocused()
      await expect(secondButton).toHaveAttribute('aria-pressed', 'true')
      await expect(firstButton).toHaveAttribute('aria-pressed', 'false')
      await expect(image).toHaveAttribute('src', /\/gallery-second\//u)
      await expect(gallery.getByRole('status')).toHaveText('Photo 2 of 5')
      await lastButton.click()
      await expect(lastButton).toBeFocused()
      await expect(image).toHaveAttribute('src', /\/gallery-fifth\//u)
      await expect(gallery.getByRole('status')).toHaveText('Photo 5 of 5')
      await expect.poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)

      const thumbnailBox = await lastButton.locator('img').boundingBox()
      const lastButtonBox = await getElementBox(lastButton)
      const documentWidth = await page.evaluate(() => globalThis.document.documentElement.scrollWidth)

      expect(thumbnailBox?.width).toBe(64)
      expect(thumbnailBox?.height).toBe(64)
      expect(lastButtonBox.x).toBeGreaterThanOrEqual(0)
      expect(lastButtonBox.x + lastButtonBox.width).toBeLessThanOrEqual(width)
      expect(documentWidth).toBeLessThanOrEqual(width)
    })
  }

  test('keeps the primary photo and item actions available while photos load', async ({ context, page }) => {
    const gate = createDeferred()

    await mockGallery(context)

    await context.route(galleryPath, async (route) => {
      await gate.promise

      await route.fulfill({ json: galleryImages })
    })

    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })

    await expect(gallery.getByRole('status')).toHaveText('Loading photos.')
    await expect(gallery.getByRole('img', { name: stoveItem.name })).toHaveAttribute('src', /\/gallery-primary\//u)
    await expect(page.getByRole('heading', { name: 'Characteristics' })).toBeVisible()
    await page.getByRole('button', { name: 'Add to My gear' }).click()
    await expect(page.getByText('In My gear', { exact: true })).toBeVisible()
    gate.resolve()
    await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 5')
  })

  test('retries a failed gallery without duplicate requests or lost focus', async ({ context, page }) => {
    const { gate, state } = await mockGalleryRetry(context)

    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })
    const retryButton = gallery.getByRole('button', { name: 'Retry' })

    await expect(gallery.getByText('Could not load photos. Try again.')).toBeVisible()
    await expect(page.getByText('Private failure details')).toHaveCount(0)
    await expect(gallery.getByRole('img', { name: stoveItem.name })).toHaveAttribute('src', /\/gallery-primary\//u)
    await retryButton.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => state.requestCount).toBe(2)
    await expect(retryButton).toBeEnabled()
    await expect(retryButton).toBeFocused()

    state.shouldFail = false

    await page.keyboard.press('Enter')
    await expect.poll(() => state.requestCount).toBe(3)
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    gate.resolve()
    await expect(retryButton).toHaveCount(0)
    await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 5')
    expect(state.requestCount).toBe(3)
    await expect(gallery).toBeFocused()
  })

  test('does not steal focus when Retry finishes after the user moves away', async ({ context, page }) => {
    const { gate, state } = await mockGalleryRetry(context)

    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })
    const retryButton = gallery.getByRole('button', { name: 'Retry' })
    const backLink = page.getByRole('link', { name: 'Back to gear library' })

    await expect(retryButton).toBeVisible()

    state.shouldFail = false

    await retryButton.click()
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    await backLink.focus()
    gate.resolve()
    await expect(retryButton).toHaveCount(0)
    await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 5')
    await expect(backLink).toBeFocused()
  })

  test('uses the placeholder for a failed image and can select another photo', async ({ context, page }) => {
    await mockGallery(context)

    await context.route('https://imagedelivery.net/*/gallery-second/*', async (route) => {
      await route.abort('failed')
    })

    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })
    const image = gallery.locator('img').first()

    await gallery.getByRole('button', { name: 'View photo 2 of 5' }).click()
    await expect(image).toHaveAttribute('src', placeholderPath)
    await expect(image).toHaveAttribute('alt', '')
    await expect(gallery.getByRole('status')).toHaveText('Could not load this photo. Try again.')
    await gallery.getByRole('button', { name: 'View photo 3 of 5' }).click()
    await expect(image).toHaveAttribute('src', /\/gallery-third\//u)
    await expect(image).toHaveAttribute('alt', stoveItem.name)
    await expect(gallery.getByRole('status')).toHaveText('Photo 3 of 5')
    await expect(gallery.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect.poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  })

  test('retries the selected photo without duplicate requests or lost focus', async ({ context, page }) => {
    const { gate, state } = await mockImageRetry(context)

    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })
    const image = gallery.locator('img').first()
    const retryButton = gallery.getByRole('button', { name: 'Retry' })

    await gallery.getByRole('button', { name: 'View photo 2 of 5' }).click()
    await expect(image).toHaveAttribute('src', placeholderPath)
    await retryButton.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => state.requestCount).toBe(2)
    await expect(gallery.getByRole('status')).toHaveText('Could not load this photo. Try again.')
    await expect(retryButton).toBeEnabled()
    await expect(retryButton).toBeFocused()

    state.shouldFail = false

    await page.keyboard.press('Enter')
    await expect.poll(() => state.requestCount).toBe(3)
    await expect(gallery.getByRole('status')).toHaveText('Retrying photo.')
    await expect(retryButton).toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    gate.resolve()
    await expect(retryButton).toHaveCount(0)
    await expect(image).toHaveAttribute('src', /\/gallery-second\//u)
    await expect(image).toHaveAttribute('alt', stoveItem.name)
    await expect.poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    await expect(gallery.getByRole('status')).toHaveText('Photo 2 of 5')
    await expect(gallery).toBeFocused()
    expect(state.requestCount).toBe(3)
  })

  test('ignores a late error from the previously selected photo', async ({ context, page }) => {
    await mockGallery(context)
    await openItem(page)

    const gallery = page.getByRole('region', { name: galleryName })
    const image = gallery.getByRole('img', { name: stoveItem.name })

    await gallery.getByRole('button', { name: 'View photo 2 of 5' }).click()
    await expect(image).toHaveAttribute('src', /\/gallery-second\//u)

    const previousImage = await image.evaluateHandle(element => element)

    await gallery.getByRole('button', { name: 'View photo 3 of 5' }).click()
    await expect(image).toHaveAttribute('src', /\/gallery-third\//u)

    await previousImage.evaluate((element) => {
      const lateError = new globalThis.Event('error')

      element.dispatchEvent(lateError)
    })

    await expect(image).toHaveAttribute('src', /\/gallery-third\//u)
    await expect.poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    await expect(gallery.getByRole('status')).toHaveText('Photo 3 of 5')
    await expect(gallery.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await previousImage.dispose()
  })

  test('cancels a pending gallery when leaving the item and resets selection on return', async ({ context, page }) => {
    const requested = createDeferred()

    await mockGallery(context)

    const holdGallery = () => { requested.resolve() }

    await context.route(galleryPath, holdGallery)
    await openItem(page)

    await requested.promise

    const aborted = page.waitForEvent('requestfailed', (request) => {
      const requestUrlValue = request.url()
      const requestUrl = new globalThis.URL(requestUrlValue)

      return requestUrl.pathname === galleryPath
    })

    await page.getByRole('link', { name: 'Back to gear library' }).click()

    const failedRequest = await aborted

    expect(failedRequest.failure()?.errorText).toBe('net::ERR_ABORTED')
    await context.unroute(galleryPath, holdGallery)

    await page.getByRole('link', {
      name: stoveItem.name,
      exact: true
    }).click()

    const gallery = page.getByRole('region', { name: galleryName })

    await gallery.getByRole('button', { name: 'View photo 4 of 5' }).click()
    await expect(gallery.getByRole('status')).toHaveText('Photo 4 of 5')
    await page.getByRole('link', { name: 'Back to gear library' }).click()

    await page.getByRole('link', {
      name: sleepingPadItem.name,
      exact: true
    }).click()

    await expect(page.getByRole('region', { name: `Photos of ${sleepingPadItem.name}` }).getByText('No photos yet.')).toBeVisible()
    await page.getByRole('link', { name: 'Back to gear library' }).click()

    await page.getByRole('link', {
      name: stoveItem.name,
      exact: true
    }).click()

    await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 5')
  })
})
