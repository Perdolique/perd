import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import itemDetailHandler from '#server/api/equipment/items/[id].get'
import listItemsHandler from '#server/api/equipment/items/index.get'
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

function createListDb({
  items = [],
  total = 0
}: {
  items?: unknown[];
  total?: number;
} = {}) {
  const itemsOffsetMock = vi.fn(() => items)
  const itemsLimitMock = vi.fn(() => {
    return {
      offset: itemsOffsetMock
    }
  })

  const itemsWhereMock = vi.fn(() => {
    return {
      limit: itemsLimitMock
    }
  })

  const itemsCategoryJoinMock = vi.fn(() => {
    return {
      where: itemsWhereMock
    }
  })

  const itemsBrandJoinMock = vi.fn(() => {
    return {
      innerJoin: itemsCategoryJoinMock
    }
  })

  const itemsFromMock = vi.fn(() => {
    return {
      innerJoin: itemsBrandJoinMock
    }
  })

  const countWhereMock = vi.fn(() => [{
    total
  }])

  const countCategoryJoinMock = vi.fn(() => {
    return {
      where: countWhereMock
    }
  })

  const countBrandJoinMock = vi.fn(() => {
    return {
      innerJoin: countCategoryJoinMock
    }
  })

  const countFromMock = vi.fn(() => {
    return {
      innerJoin: countBrandJoinMock
    }
  })

  const selectMock = vi.fn()

  selectMock
    .mockImplementationOnce(() => {
      return {
        from: itemsFromMock
      }
    })
    .mockImplementationOnce(() => {
      return {
        from: countFromMock
      }
    })

  return {
    dbHttp: {
      select: selectMock
    },
    itemsLimitMock,
    itemsOffsetMock,
    itemsWhereMock
  }
}

function createDetailDb(item?: unknown) {
  const findFirstMock = vi.fn(() => item)

  return {
    dbHttp: {
      query: {
        equipmentItems: {
          findFirst: findFirstMock
        }
      }
    },
    findFirstMock
  }
}

describe('item read handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedQueryMock.mockResolvedValue({
      brandSlug: undefined,
      categorySlug: undefined,
      limit: 20,
      page: 1,
      search: ''
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/equipment/items', () => {
    test('should return paginated items list', async () => {
      const items = [{
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'NeoAir XLite NXT Regular',

        brand: {
          name: 'Therm-a-Rest',
          slug: 'therm-a-rest'
        },

        category: {
          name: 'Sleeping Pads',
          slug: 'sleeping-pads'
        }
      }]

      const { dbHttp, itemsLimitMock, itemsOffsetMock, itemsWhereMock } = createListDb({
        items,
        total: 42
      })

      const event = createTestEvent(dbHttp)

      getValidatedQueryMock.mockResolvedValue({
        brandSlug: 'therm-a-rest',
        categorySlug: 'sleeping-pads',
        limit: 10,
        page: 2,
        search: 'neoair'
      })

      const result = await listItemsHandler(event)

      expect(result).toStrictEqual({
        items,
        limit: 10,
        page: 2,
        total: 42
      })

      expect(itemsWhereMock).toHaveBeenCalledTimes(1)
      expect(itemsLimitMock).toHaveBeenCalledWith(10)
      expect(itemsOffsetMock).toHaveBeenCalledWith(10)
    })

    test('should return 400 when query validation fails', async () => {
      const queryError = h3.createError({ status: 400 })
      const { dbHttp } = createListDb()
      const event = createTestEvent(dbHttp)

      getValidatedQueryMock.mockRejectedValue(queryError)

      await expect(listItemsHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('GET /api/equipment/items/[id]', () => {
    test('should return item detail with normalized property values', async () => {
      const item = {
        createdAt: '2026-04-01T00:00:00Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe',
        status: 'approved',

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

        propertyValues: [{
          valueBoolean: null,
          valueNumber: '83',
          valueText: null,

          property: {
            dataType: 'number',
            name: 'Weight',
            slug: 'weight',
            unit: 'g'
          }
        }, {
          valueBoolean: true,
          valueNumber: null,
          valueText: null,

          property: {
            dataType: 'boolean',
            name: 'Piezo',
            slug: 'piezo',
            unit: null
          }
        }, {
          valueBoolean: null,
          valueNumber: null,
          valueText: 'canister',

          property: {
            dataType: 'enum',
            name: 'Fuel',
            slug: 'fuel',
            unit: null
          }
        }, {
          valueBoolean: null,
          valueNumber: null,
          valueText: 'ignore-me',

          property: null
        }]
      }

      const { dbHttp, findFirstMock } = createDetailDb(item)
      const event = createTestEvent(dbHttp)
      const result = await itemDetailHandler(event)

      expect(result).toStrictEqual({
        createdAt: '2026-04-01T00:00:00Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe',
        status: 'approved',

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

        properties: [{
          dataType: 'number',
          name: 'Weight',
          slug: 'weight',
          unit: 'g',
          value: '83'
        }, {
          dataType: 'boolean',
          name: 'Piezo',
          slug: 'piezo',
          unit: null,
          value: 'true'
        }, {
          dataType: 'enum',
          name: 'Fuel',
          slug: 'fuel',
          unit: null,
          value: 'canister'
        }]
      })

      expect(findFirstMock).toHaveBeenCalledTimes(1)
    })

    test('should return 400 when route params validation fails', async () => {
      const routeError = h3.createError({ status: 400 })
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(itemDetailHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    test('should return 404 when item id does not exist', async () => {
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(itemDetailHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })
})
