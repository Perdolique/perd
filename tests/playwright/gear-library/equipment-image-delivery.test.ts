import type { Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

import {
  comparisonItemIds,
  createComparisonResponse,
  mockComparisonApi,
  openComparisonPage
} from '../fixtures/gear-library-comparison.fixtures.ts'

import {
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  sleepingPadItem,
  stoveItem
} from '../fixtures/gear-library-entry-list.fixtures.ts'

const accountHash = 'mCIRaHLLCfuPRvd-hC9t5g'
const catalogImageId = 'catalog-image'
const detailImageId = 'detail-image'
const compareImageId = 'compare-image'
const failedImageId = 'failed-image'
const placeholderPath = '/equipment-item-placeholder.webp'
const imageBody = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'

const twoItemComparisonSizes = '(max-width: 599px) 176px, (max-width: 899px) 33vw, '
  + '(max-width: 1279px) 25vw, 288px'

const threeItemComparisonSizes = '(max-width: 799px) 176px, (max-width: 899px) 23vw, '
  + '(max-width: 1049px) 176px, (max-width: 1439px) 20vw, 288px'

const fourItemComparisonSizes = '(max-width: 1249px) 176px, (max-width: 1535px) 15vw, 220px'

const comparisonImageLayoutCases = [{
  expectedImageWidth: 288,
  expectedMaximumRenderedWidth: 270,
  expectedMinimumRenderedWidth: 240,
  expectedSizes: twoItemComparisonSizes,
  itemCount: 2,
  viewportWidth: 768
}, {
  expectedImageWidth: 176,
  expectedMaximumRenderedWidth: 190,
  expectedMinimumRenderedWidth: 165,
  expectedSizes: threeItemComparisonSizes,
  itemCount: 3,
  viewportWidth: 1024
}, {
  expectedImageWidth: 220,
  expectedMaximumRenderedWidth: 190,
  expectedMinimumRenderedWidth: 165,
  expectedSizes: fourItemComparisonSizes,
  itemCount: 4,
  viewportWidth: 1280
}] as const

function createFlexibleImageUrl(imageId: string, operations: string): string {
  return `https://imagedelivery.net/${accountHash}/${imageId}/${operations}`
}

function addFirstComparisonImage(response: ReturnType<typeof createComparisonResponse>) {
  const [firstItem, ...remainingItems] = response.items

  return {
    category: response.category,

    items: [{
      ...firstItem,
      cloudflareImageId: compareImageId
    }, ...remainingItems],

    properties: response.properties
  }
}

function createComparisonImageResponse(request: Request) {
  const requestUrl = new globalThis.URL(request.url())
  const itemIds = requestUrl.searchParams.getAll('itemId')
  const response = createComparisonResponse(itemIds)

  return addFirstComparisonImage(response)
}

function isLegacyImageByteRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())

  return request.method() === 'GET'
    && /^\/api\/equipment\/items\/[^/]+\/images\/[^/]+$/u.test(requestUrl.pathname)
}

test.describe('Direct equipment image delivery', () => {
  test.beforeEach(async ({ context }) => {
    await mockGuestLogin(context)
  })

  test('should request responsive Flexible Variants for catalog, detail, and comparison', async ({
    context,
    page
  }) => {
    const imageRequests: string[] = []
    const pageRequests: Request[] = []

    const catalogItem = {
      ...stoveItem,
      cloudflareImageId: catalogImageId
    }

    const catalogUrl = createFlexibleImageUrl(catalogImageId, 'w=48,h=48,fit=cover')
    const catalogRetinaUrl = createFlexibleImageUrl(catalogImageId, 'w=96,h=96,fit=cover')
    const detailUrl = createFlexibleImageUrl(detailImageId, 'w=1120,h=840,fit=scale-down')
    const compareUrl = createFlexibleImageUrl(compareImageId, 'w=288,h=216,fit=contain')

    page.on('request', (request) => {
      pageRequests.push(request)
    })

    await context.route('https://imagedelivery.net/**', async (route) => {
      imageRequests.push(route.request().url())

      await route.fulfill({
        body: imageBody,
        contentType: 'image/svg+xml',
        status: 200
      })
    })

    await mockCatalogApi(context, {
      itemDetails: () => {
        return {
          json: {
            brand: {
              id: 1,
              ...catalogItem.brand
            },

            category: {
              id: 2,
              ...catalogItem.category
            },

            cloudflareImageId: detailImageId,
            createdAt: '2088-04-20T12:00:00.000Z',
            id: catalogItem.id,
            name: catalogItem.name,
            properties: catalogItem.properties
          }
        }
      },

      items: () => {
        return {
          json: {
            items: [catalogItem, sleepingPadItem],
            limit: 10,
            page: 1,
            total: 2
          }
        }
      }
    })

    const comparedItemIds = comparisonItemIds.slice(0, 2)
    const baseComparisonResponse = createComparisonResponse(comparedItemIds)
    const comparisonResponse = addFirstComparisonImage(baseComparisonResponse)

    await mockComparisonApi(context, {
      comparison: () => {
        return { json: comparisonResponse }
      }
    })

    await openGearLibrary(page)

    const catalogRow = page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: catalogItem.name })
    })

    const catalogImage = catalogRow.locator('img')

    await expect(catalogImage).toHaveAttribute('src', catalogUrl)
    await expect(catalogImage).toHaveAttribute(
      'srcset',
      `${catalogUrl} 1x, ${catalogRetinaUrl} 2x`
    )
    await expect(catalogImage).toHaveJSProperty('currentSrc', catalogUrl)
    await expect(catalogImage).toHaveAttribute('width', '48')
    await expect(catalogImage).toHaveAttribute('height', '48')
    await expect(catalogImage).toHaveAttribute('loading', 'lazy')
    await expect(catalogImage).toHaveAttribute('alt', '')

    await page.getByRole('link', { name: catalogItem.name }).click()

    const detailImage = page.getByAltText(catalogItem.name)
    const detailSrcset = await detailImage.getAttribute('srcset')

    expect(detailSrcset).toContain(`${detailUrl} 1120w`)
    await expect(detailImage).toHaveJSProperty('currentSrc', detailUrl)
    await expect(detailImage).toHaveAttribute('width', '1120')
    await expect(detailImage).toHaveAttribute('height', '840')
    await expect(detailImage).toHaveAttribute('loading', 'eager')
    await expect(detailImage).toHaveAttribute(
      'sizes',
      '(max-width: 1023px) 100vw, (max-width: 1535px) 75vw, 1120px'
    )

    await openComparisonPage(page, comparedItemIds)

    const firstComparisonHeader = page.getByRole('columnheader').nth(1)
    const comparisonImage = firstComparisonHeader.locator('img')
    const comparisonSrcset = await comparisonImage.getAttribute('srcset')

    expect(comparisonSrcset).toContain(`${compareUrl} 288w`)
    await expect(comparisonImage).toHaveJSProperty('currentSrc', compareUrl)
    await expect(comparisonImage).toHaveAttribute('width', '288')
    await expect(comparisonImage).toHaveAttribute('height', '216')
    await expect(comparisonImage).toHaveAttribute('loading', 'lazy')
    await expect(comparisonImage).toHaveAttribute('alt', '')
    await expect(comparisonImage).toHaveAttribute(
      'sizes',
      '(max-width: 599px) 176px, (max-width: 899px) 33vw, (max-width: 1279px) 25vw, 288px'
    )

    await expect.poll(() => imageRequests).toEqual(expect.arrayContaining([
      catalogUrl,
      detailUrl,
      compareUrl
    ]))

    for (const imageRequest of imageRequests) {
      expect(imageRequest).not.toMatch(/\/(?:catalog|compare|detail|public)$/u)
    }

    const legacyRequests = pageRequests.filter((request) => isLegacyImageByteRequest(request))

    expect(legacyRequests).toHaveLength(0)
  })

  test('should use the placeholder for missing and failed catalog images', async ({
    context,
    page
  }) => {
    const failedItem = {
      ...stoveItem,
      cloudflareImageId: failedImageId
    }

    const failedUrl = createFlexibleImageUrl(failedImageId, 'w=48,h=48,fit=cover')
    const failedRetinaUrl = createFlexibleImageUrl(failedImageId, 'w=96,h=96,fit=cover')

    await context.route(failedUrl, async (route) => {
      await route.abort('failed')
    })
    await context.route(failedRetinaUrl, async (route) => {
      await route.abort('failed')
    })

    await mockCatalogApi(context, {
      items: () => {
        return {
          json: {
            items: [failedItem, sleepingPadItem],
            limit: 10,
            page: 1,
            total: 2
          }
        }
      }
    })

    await openGearLibrary(page)

    const failedRow = page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: failedItem.name })
    })

    const missingRow = page.getByRole('listitem').filter({
      has: page.getByRole('link', { name: sleepingPadItem.name })
    })

    await expect(failedRow.locator('img')).toHaveAttribute('src', placeholderPath)
    await expect(missingRow.locator('img')).toHaveAttribute('src', placeholderPath)
  })

  for (const comparisonCase of comparisonImageLayoutCases) {
    test(`should request a suitable comparison image for ${comparisonCase.itemCount} items at ${comparisonCase.viewportWidth}px`, async ({
      context,
      page
    }) => {
      const comparedItemIds = comparisonItemIds.slice(0, comparisonCase.itemCount)
      const imageHeight = comparisonCase.expectedImageWidth * 0.75
      const operations = `w=${comparisonCase.expectedImageWidth},h=${imageHeight},fit=contain`
      const comparisonUrl = createFlexibleImageUrl(compareImageId, operations)

      const viewport = {
        width: comparisonCase.viewportWidth,
        height: 720
      }

      await page.setViewportSize(viewport)
      await context.route('https://imagedelivery.net/**', async (route) => {
        await route.fulfill({
          body: imageBody,
          contentType: 'image/svg+xml',
          status: 200
        })
      })
      await mockComparisonApi(context, {
        comparison: (request) => {
          const json = createComparisonImageResponse(request)

          return { json }
        }
      })

      await openComparisonPage(page, comparedItemIds)

      const comparisonImage = page.getByRole('columnheader').nth(1).locator('img')
      const renderedWidth = await comparisonImage.evaluate((image) => image.clientWidth)

      expect(renderedWidth).toBeGreaterThan(comparisonCase.expectedMinimumRenderedWidth)
      expect(renderedWidth).toBeLessThan(comparisonCase.expectedMaximumRenderedWidth)
      await expect(comparisonImage).toHaveJSProperty('currentSrc', comparisonUrl)
      await expect(comparisonImage).toHaveAttribute('sizes', comparisonCase.expectedSizes)
    })
  }
})
