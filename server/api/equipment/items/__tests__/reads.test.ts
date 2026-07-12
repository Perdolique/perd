import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import itemDetailHandler from '#server/api/equipment/items/[id].get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getValidatedRouterParamsMock } = vi.hoisted(() => {
  return {
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    }
  }
})

interface DetailPropertyColumns {
  displayOrder: boolean;
  id: boolean;
}

interface DetailPropertyConfig {
  columns: DetailPropertyColumns;
}

interface DetailPropertyRelationConfig {
  property: DetailPropertyConfig;
}

interface DetailPropertyValuesConfig {
  with: DetailPropertyRelationConfig;
}

interface DetailRelationsConfig {
  propertyValues: DetailPropertyValuesConfig;
}

interface DetailWhereConfig {
  id: string;
  status: string;
}

interface DetailQueryConfig {
  where: DetailWhereConfig;
  with: DetailRelationsConfig;
}

function createDetailDb(item?: unknown) {
  const findFirstMock = vi.fn((_config: DetailQueryConfig) => item)

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

describe('get /api/equipment/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return approved item detail with ordered normalized property values', async () => {
    const item = {
      createdAt: '2026-04-01T00:00:00Z',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      name: 'PocketRocket Deluxe',

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
          displayOrder: 2,
          id: 3,
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
          displayOrder: 0,
          id: 1,
          name: 'Piezo',
          slug: 'piezo',
          unit: null
        }
      }, {
        valueBoolean: null,
        valueNumber: null,
        valueText: null,

        property: {
          dataType: 'text',
          displayOrder: 3,
          id: 4,
          name: 'Notes',
          slug: 'notes',
          unit: null
        }
      }, {
        valueBoolean: null,
        valueNumber: null,
        valueText: 'canister',

        property: {
          dataType: 'enum',
          displayOrder: 1,
          id: 2,
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
        dataType: 'boolean',
        name: 'Piezo',
        slug: 'piezo',
        unit: null,
        value: true
      }, {
        dataType: 'enum',
        name: 'Fuel',
        slug: 'fuel',
        unit: null,
        value: 'canister'
      }, {
        dataType: 'number',
        name: 'Weight',
        slug: 'weight',
        unit: 'g',
        value: 83
      }, {
        dataType: 'text',
        name: 'Notes',
        slug: 'notes',
        unit: null,
        value: null
      }]
    })
    const [findFirstCall] = findFirstMock.mock.calls
    const queryConfig = findFirstCall?.[0]

    expect(queryConfig?.where).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      status: 'approved'
    })
    expect(queryConfig?.with.propertyValues.with.property.columns).toStrictEqual(expect.objectContaining({
      displayOrder: true,
      id: true
    }))
  })

  it('should return 400 when route params validation fails', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createDetailDb()
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(itemDetailHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it.each(['missing', 'pending', 'rejected'])(
    'should return 404 when the item is %s',
    async () => {
      const { dbHttp } = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(itemDetailHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    }
  )
})
