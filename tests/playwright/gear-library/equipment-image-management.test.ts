import type { BrowserContext, Page, Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const firstImageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const secondImageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const imagesPath = `/api/equipment/items/${itemId}/images`
const accountHash = 'mCIRaHLLCfuPRvd-hC9t5g'
const firstPreviewUrl = `https://imagedelivery.net/${accountHash}/cloudflare-image-1/w=320,h=320,fit=cover`
const firstRetinaPreviewUrl = `https://imagedelivery.net/${accountHash}/cloudflare-image-1/w=640,h=640,fit=cover`
const secondPreviewUrl = `https://imagedelivery.net/${accountHash}/cloudflare-image-2/w=320,h=320,fit=cover`
const imageBody = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'

async function navigateWithinApp(page: Page, path: string) {
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

    const config = getRequiredProperty(vueApp, 'config')
    const globalProperties = getRequiredProperty(config, 'globalProperties')
    const router = getRequiredProperty(globalProperties, '$router')
    const push = getRequiredProperty(router, 'push')

    if (typeof push !== 'function') {
      throw new TypeError('Expected the Nuxt router push function')
    }

    await Reflect.apply(push, router, [nextPath])
  }, path)
}

const firstImage = {
  cloudflareImageId: 'cloudflare-image-1',
  displayOrder: 0,
  id: firstImageId
}

const secondImage = {
  cloudflareImageId: 'cloudflare-image-2',
  displayOrder: 1,
  id: secondImageId
}

async function mockSequentialImageUploadApi(context: BrowserContext) {
  const uploadRequests: Request[] = []
  const firstResponseGate = createDeferred()

  await context.route(`**${imagesPath}**`, async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      uploadRequests.push(request)

      if (uploadRequests.length === 1) {
        await firstResponseGate.promise
      }

      await route.fulfill({
        json: firstImage,
        status: 201
      })

      return
    }

    await route.fulfill({ json: [] })
  })

  return {
    firstResponseGate,
    uploadRequests
  }
}

test.describe('Equipment image management', () => {
  test('should upload multiple images sequentially in selection order', async ({
    context,
    page
  }) => {
    const firstFilename = 'equipment-item-placeholder.webp'
    const secondFilename = 'photo-submission.webp'

    await context.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        json: {
          isAdmin: true,
          isGuest: false,
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    const { firstResponseGate, uploadRequests } = await mockSequentialImageUploadApi(context)
    const pagePath = `/admin/equipment/items/${itemId}/images`
    const authPath = `/auth/twitch?code=oauth-code&state=${encodeURIComponent(pagePath)}`

    await page.goto(authPath)

    const imageInput = page.getByLabel('Choose images', { exact: true })

    await expect(imageInput).toHaveAttribute('multiple', '')
    await expect(imageInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    await imageInput.setInputFiles([
      `public/${firstFilename}`,
      `tests/playwright/fixtures/${secondFilename}`
    ])
    await expect(page.getByText('2 files selected', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Upload' }).click()

    await expect.poll(() => uploadRequests).toHaveLength(1)
    await expect(imageInput).toBeDisabled()

    firstResponseGate.resolve()

    await expect.poll(() => uploadRequests).toHaveLength(2)
    await expect(imageInput).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Upload' })).toBeDisabled()

    const uploadFilenames = uploadRequests.map((request) => {
      const requestUrl = new globalThis.URL(request.url())

      return requestUrl.searchParams.get('filename')
    })

    const contentTypes = await Promise.all(
      uploadRequests.map(async (request) => {
        const contentType = await request.headerValue('content-type')

        return contentType
      })
    )

    expect(uploadFilenames).toEqual([firstFilename, secondFilename])
    expect(contentTypes).toEqual(['image/webp', 'image/webp'])
  })

  test('should delete an image and refresh the gallery order', async ({
    context,
    page
  }) => {
    let images = [firstImage, secondImage]
    let deleteRequestCount = 0
    const previewRequests: string[] = []

    await context.route('https://imagedelivery.net/**', async (route) => {
      previewRequests.push(route.request().url())

      await route.fulfill({
        body: imageBody,
        contentType: 'image/svg+xml',
        status: 200
      })
    })

    await context.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        json: {
          isAdmin: true,
          isGuest: false,
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    await context.route(imagesPath, async (route) => {
      expect(route.request().method()).toBe('GET')

      await route.fulfill({ json: images })
    })

    await context.route(`${imagesPath}/${firstImageId}`, async (route) => {
      expect(route.request().method()).toBe('DELETE')

      deleteRequestCount += 1
      images = [secondImage]

      await route.fulfill({ status: 204 })
    })

    const pagePath = `/admin/equipment/items/${itemId}/images`
    const authPath = `/auth/twitch?code=oauth-code&state=${encodeURIComponent(pagePath)}`

    await page.goto(authPath)

    await expect(page).toHaveURL(new RegExp(`${pagePath}$`, 'u'))
    await expect(page.getByRole('button', { name: 'Delete equipment image 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Delete equipment image/u })).toHaveCount(2)

    const firstPreview = page.getByAltText('Equipment image 1')

    await expect(firstPreview).toHaveAttribute('src', firstPreviewUrl)
    await expect(firstPreview).toHaveAttribute(
      'srcset',
      `${firstPreviewUrl} 1x, ${firstRetinaPreviewUrl} 2x`
    )
    await expect(firstPreview).toHaveJSProperty('currentSrc', firstPreviewUrl)
    await expect(firstPreview).toHaveAttribute('width', '320')
    await expect(firstPreview).toHaveAttribute('height', '320')
    await expect(firstPreview).toHaveAttribute('loading', 'lazy')
    await expect.poll(() => previewRequests).toEqual(expect.arrayContaining([
      firstPreviewUrl,
      secondPreviewUrl
    ]))

    await page.getByRole('button', { name: 'Delete equipment image 1' }).click()

    await expect.poll(() => deleteRequestCount).toBe(1)
    await expect(page.getByRole('button', { name: /^Delete equipment image/u })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Delete equipment image 1' })).toBeVisible()
    await expect(page.getByText('Primary', { exact: true })).toBeVisible()
  })

  test('should expose the reordered primary image after a public detail refresh', async ({
    context,
    page
  }) => {
    let images = [firstImage, secondImage]
    let primaryCloudflareImageId = firstImage.cloudflareImageId
    const secondDetailImageUrl = `https://imagedelivery.net/${accountHash}/cloudflare-image-2/w=1120,h=840,fit=scale-down`

    await context.route('https://imagedelivery.net/**', async (route) => {
      await route.fulfill({
        body: imageBody,
        contentType: 'image/svg+xml',
        status: 200
      })
    })

    await context.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        json: {
          isAdmin: true,
          isGuest: false,
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    await context.route(imagesPath, async (route) => {
      await route.fulfill({ json: images })
    })

    await context.route(`${imagesPath}/order`, async (route) => {
      expect(route.request().method()).toBe('PATCH')
      expect(route.request().postDataJSON()).toStrictEqual({
        imageIds: [secondImageId, firstImageId]
      })

      images = [
        {
          ...secondImage,
          displayOrder: 0
        },
        {
          ...firstImage,
          displayOrder: 1
        }
      ]
      primaryCloudflareImageId = secondImage.cloudflareImageId

      await route.fulfill({ status: 204 })
    })

    await context.route(`/api/equipment/items/${itemId}`, async (route) => {
      await route.fulfill({
        json: {
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

          cloudflareImageId: primaryCloudflareImageId,
          createdAt: '2088-04-20T12:00:00.000Z',
          id: itemId,
          name: 'PocketRocket Deluxe',
          properties: []
        }
      })
    })

    const adminPath = `/admin/equipment/items/${itemId}/images`
    const authPath = `/auth/twitch?code=oauth-code&state=${encodeURIComponent(adminPath)}`

    await page.goto(authPath)
    await expect(page).toHaveURL(new RegExp(`${adminPath}$`, 'u'))

    const firstCard = page.getByAltText('Equipment image 1').locator('..')
    const secondCard = page.getByAltText('Equipment image 2').locator('..')

    await firstCard.dragTo(secondCard)
    await expect(page.getByAltText('Equipment image 1')).toHaveJSProperty(
      'currentSrc',
      secondPreviewUrl
    )

    await navigateWithinApp(page, `/gear-library/${itemId}`)

    await expect(page.getByAltText('PocketRocket Deluxe')).toHaveJSProperty(
      'currentSrc',
      secondDetailImageUrl
    )
  })
})
