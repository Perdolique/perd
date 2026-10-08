import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import brandDetailHandler from '#server/api/equipment/brands/by-slug/[slug].get'
import listBrandsHandler from '#server/api/equipment/brands/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedQueryMock,
  getValidatedRouteParamsMock
} = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof nuxtServer.getValidatedQuery>(),
    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>()
  }
})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {
  return {
    getValidatedRouteParams: getValidatedRouteParamsMock
  }
})

vi.mock(import('nuxt/server'), async () => {
  const actual = await vi.importActual<typeof nuxtServer>('nuxt/server')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof nuxtServer.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    }
  }
})

interface BrandListItem {
  id: number;
  name: string;
  slug: string;
}

interface BrandDetail {
  id: number;
  name: string;
  slug: string;
}

function createListDb({
  filteredBrands = [],
  unfilteredBrands = []
}: {
  filteredBrands?: BrandListItem[];
  unfilteredBrands?: BrandListItem[];
} = {}) {
  const whereMock = vi.fn(() => filteredBrands)

  const fromMock = vi.fn(() => {
    if (filteredBrands.length === 0) {
      return unfilteredBrands
    }

    return {
      where: whereMock
    }
  })

  const selectMock = vi.fn(() => {
    return {
      from: fromMock
    }
  })

  return {
    dbHttp: {
      select: selectMock
    },

    whereMock
  }
}

function createDetailDb(brand?: BrandDetail) {
  const findFirstMock = vi.fn(() => brand)

  return {
    dbHttp: {
      query: {
        brands: {
          findFirst: findFirstMock
        }
      }
    },

    findFirstMock
  }
}

describe('brand read handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedQueryMock.mockResolvedValue({
      search: ''
    })

    getValidatedRouteParamsMock.mockResolvedValue({
      slug: 'msr'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get /api/equipment/brands', () => {
    it('should return all brands when search is empty', async () => {
      const brands = [{
        id: 1,
        name: 'MSR',
        slug: 'msr'
      }, {
        id: 2,
        name: 'Nemo',
        slug: 'nemo'
      }]

      const { dbHttp, whereMock } = createListDb({
        unfilteredBrands: brands
      })

      const event = createTestEvent(dbHttp)
      const result = await listBrandsHandler(event)

      expect(result).toStrictEqual(brands)
      expect(whereMock).not.toHaveBeenCalled()
    })

    it('should return filtered brands when search is present', async () => {
      const filteredBrands = [{
        id: 1,
        name: 'MSR',
        slug: 'msr'
      }]

      const { dbHttp, whereMock } = createListDb({
        filteredBrands
      })

      const event = createTestEvent(dbHttp)

      getValidatedQueryMock.mockResolvedValue({
        search: 'msr'
      })

      const result = await listBrandsHandler(event)

      expect(result).toStrictEqual(filteredBrands)
      expect(whereMock).toHaveBeenCalledTimes(1)
    })

    it('should return 400 when query validation fails', async () => {
      const queryError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createListDb()
      const event = createTestEvent(dbHttp)

      getValidatedQueryMock.mockRejectedValue(queryError)

      await expect(listBrandsHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('get /api/equipment/brands/by-slug/[slug]', () => {
    it('should return brand detail for a known slug', async () => {
      const brand = {
        id: 1,
        name: 'MSR',
        slug: 'msr'
      }

      const { dbHttp, findFirstMock } = createDetailDb(brand)
      const event = createTestEvent(dbHttp)
      const result = await brandDetailHandler(event)

      expect(result).toStrictEqual(brand)
      expect(findFirstMock).toHaveBeenCalledTimes(1)
    })

    it('should return 400 when route param is missing', async () => {
      const routeError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouteParamsMock.mockRejectedValue(routeError)

      await expect(brandDetailHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    it('should return 404 when brand slug does not exist', async () => {
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(brandDetailHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })
})
