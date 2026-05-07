import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import brandDetailHandler from '#server/api/equipment/brands/[slug].get'
import listBrandsHandler from '#server/api/equipment/brands/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedQueryMock,
  getValidatedRouterParamsMock
} = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    },

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
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

    getValidatedRouterParamsMock.mockResolvedValue({
      slug: 'msr'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get /api/equipment/brands', () => {
    test('should return all brands when search is empty', async () => {
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

    test('should return filtered brands when search is present', async () => {
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

    test('should return 400 when query validation fails', async () => {
      const queryError = h3.createError({ status: 400 })
      const { dbHttp } = createListDb()
      const event = createTestEvent(dbHttp)

      getValidatedQueryMock.mockRejectedValue(queryError)

      await expect(listBrandsHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('get /api/equipment/brands/[slug]', () => {
    test('should return brand detail for a known slug', async () => {
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

    test('should return 400 when route param is missing', async () => {
      const routeError = h3.createError({ status: 400 })
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(brandDetailHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    test('should return 404 when brand slug does not exist', async () => {
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(brandDetailHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })
})
