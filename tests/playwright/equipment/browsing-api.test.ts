import * as v from 'valibot'
import { expect } from '@playwright/test'
import { test } from '../fixtures'

import {
  brandDetailSchema,
  brandsSchema,
  categoriesSchema,
  categoryDetailSchema,
  groupsSchema,
  itemDetailSchema,
  itemsPageSchema
} from './schemas'

import { appBaseUrl } from '../constants'

test.describe('Equipment browsing API', () => {
  test.describe('Groups', () => {
    test('returns all groups', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/groups')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(groupsSchema, raw)
      const groupNames = body.map((group) => group.name)

      expect(body).toHaveLength(12)

      expect(groupNames).toEqual(
        expect.arrayContaining(['Sleep', 'Shelter', 'Cooking', 'Water'])
      )
    })
  })

  test.describe('Categories', () => {
    test('returns all categories', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/categories')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(categoriesSchema, raw)
      const categoryNames = body.map((category) => category.name)

      expect(body).toHaveLength(5)

      expect(categoryNames).toEqual(
        expect.arrayContaining(['Sleeping Bags', 'Tents'])
      )
    })

    test('returns category detail with properties', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/categories/sleeping-bags')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(categoryDetailSchema, raw)

      expect(body.name).toBe('Sleeping Bags')
      expect(body.slug).toBe('sleeping-bags')
      expect(body.properties.length).toBeGreaterThan(0)

      const tempRating = body.properties.find((property) => property.slug === 'temperature-rating')

      if (tempRating === undefined) {
        throw new Error('temperature-rating property missing')
      }

      expect(tempRating.slug).toBe('temperature-rating')
      expect(tempRating.dataType).toBe('number')
      expect(tempRating.enumOptions).toBeUndefined()

      const fillType = body.properties.find((property) => property.slug === 'fill-type')

      if (fillType === undefined) {
        throw new Error('fill-type property missing')
      }

      expect(fillType.dataType).toBe('enum')
      expect(fillType.enumOptions?.length).toBeGreaterThan(0)
    })

    test('returns 404 for nonexistent category slug', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/categories/nonexistent-slug')

      expect(response.status()).toBe(404)
    })
  })

  test.describe('Brands', () => {
    test('returns all brands', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/brands')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(brandsSchema, raw)
      const brandNames = body.map((brand) => brand.name)

      expect(body).toHaveLength(8)

      expect(brandNames).toEqual(
        expect.arrayContaining(['MSR', 'Nemo'])
      )
    })

    test('filters brands by search query', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/brands?search=msr')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(brandsSchema, raw)
      const brandNames = body.map((brand) => brand.name)

      expect(body.length).toBeGreaterThanOrEqual(1)
      expect(brandNames).toContain('MSR')
    })

    test('returns empty array for nonexistent brand search', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/brands?search=nonexistentbrand999')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(brandsSchema, raw)

      expect(body).toEqual([])
    })

    test('returns brand detail with items', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/brands/msr')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(brandDetailSchema, raw)
      const itemNames = body.items.map((item) => item.name)

      expect(body.name).toBe('MSR')
      expect(body.slug).toBe('msr')
      expect(body.items.length).toBeGreaterThanOrEqual(2)

      expect(itemNames).toEqual(
        expect.arrayContaining([
          expect.stringContaining('PocketRocket'),
          expect.stringContaining('Guardian')
        ])
      )
    })

    test('returns 404 for nonexistent brand slug', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/brands/nonexistent-brand')

      expect(response.status()).toBe(404)
    })
  })

  test.describe('Items', () => {
    test('returns paginated items list with no filters', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/items')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(itemsPageSchema, raw)

      expect(body.total).toBe(6)
      expect(body.page).toBe(1)
      expect(body.limit).toBe(20)
      expect(body.items).toHaveLength(6)
    })

    test('filters items by category slug', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/items?categorySlug=sleeping-pads')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(itemsPageSchema, raw)

      expect(body.total).toBe(2)
      expect(body.items).toHaveLength(2)

      for (const item of body.items) {
        expect(item.category.slug).toBe('sleeping-pads')
      }
    })

    test('filters items by search query', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/items?search=NeoAir')

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(itemsPageSchema, raw)
      const itemNames = body.items.map((item) => item.name)

      expect(body.items.length).toBeGreaterThanOrEqual(1)

      expect(itemNames).toEqual(
        expect.arrayContaining([
          expect.stringContaining('NeoAir')
        ])
      )
    })

    test('paginates items correctly', async ({ authedRequest }) => {
      const [page1Response, page2Response] = await Promise.all([
        authedRequest.get('/api/equipment/items?limit=2&page=1'),
        authedRequest.get('/api/equipment/items?limit=2&page=2')
      ])

      expect(page1Response.status()).toBe(200)
      expect(page2Response.status()).toBe(200)

      const page1Raw: unknown = await page1Response.json()
      const page2Raw: unknown = await page2Response.json()
      const page1 = v.parse(itemsPageSchema, page1Raw)
      const page2 = v.parse(itemsPageSchema, page2Raw)

      expect(page1.items).toHaveLength(2)
      expect(page1.total).toBe(6)
      expect(page1.page).toBe(1)
      expect(page1.limit).toBe(2)

      expect(page2.items).toHaveLength(2)
      expect(page2.total).toBe(6)
      expect(page2.page).toBe(2)

      const page1Ids = page1.items.map((item) => item.id)
      const page2Ids = page2.items.map((item) => item.id)

      for (const itemId of page2Ids) {
        expect(page1Ids).not.toContain(itemId)
      }
    })

    test('returns item detail with properties', async ({ authedRequest }) => {
      const listResponse = await authedRequest.get('/api/equipment/items?categorySlug=sleeping-pads&search=NeoAir')
      const listRaw: unknown = await listResponse.json()
      const listBody = v.parse(itemsPageSchema, listRaw)
      const item = listBody.items.at(0)

      expect(listBody.items.length).toBeGreaterThan(0)

      if (item === undefined) { throw new Error('expected at least one item in list response') }

      const itemId = item.id
      const response = await authedRequest.get(`/api/equipment/items/${itemId}`)

      expect(response.status()).toBe(200)

      const raw: unknown = await response.json()
      const body = v.parse(itemDetailSchema, raw)

      expect(body.id).toBe(itemId)
      expect(body.name).toContain('NeoAir')
      expect(body.status).toBe('approved')
      expect(body.brand.name).toBe('Therm-a-Rest')
      expect(body.brand.slug).toBe('therm-a-rest')
      expect(body.category.name).toBe('Sleeping Pads')
      expect(body.category.slug).toBe('sleeping-pads')
      expect(body.properties.length).toBeGreaterThan(0)

      const rValue = body.properties.find((property) => property.slug === 'r-value')

      if (rValue === undefined) {
        throw new Error('r-value property missing from response')
      }

      expect(rValue.value).not.toBeNull()
    })

    test('returns 404 for nonexistent item id', async ({ authedRequest }) => {
      const response = await authedRequest.get('/api/equipment/items/00000000-0000-0000-0000-000000000000')

      expect(response.status()).toBe(404)
    })
  })

  test.describe('Auth required', () => {
    test('returns 401 without session cookie', async ({ playwright }) => {
      const anonRequest = await playwright.request.newContext({ baseURL: appBaseUrl })

      try {
        const response = await anonRequest.get('/api/equipment/groups')

        expect(response.status()).toBe(401)
      } finally {
        await anonRequest.dispose()
      }
    })
  })
})
