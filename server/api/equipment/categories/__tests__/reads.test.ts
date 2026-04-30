import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import categoryDetailHandler from '#server/api/equipment/categories/[slug].get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedRouterParamsMock
} = vi.hoisted(() => {
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

interface CategoryPropertyEnumOption {
  id: number;
  name: string;
  slug: string;
}

interface CategoryDetailProperty {
  dataType: string;
  enumOptions?: CategoryPropertyEnumOption[];
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface CategoryDetail {
  id: number;
  name: string;
  properties: CategoryDetailProperty[];
  slug: string;
}

function createDetailDb(category?: CategoryDetail) {
  const findFirstMock = vi.fn(() => category)

  return {
    dbHttp: {
      query: {
        equipmentCategories: {
          findFirst: findFirstMock
        }
      }
    },

    findFirstMock
  }
}

describe('GET /api/equipment/categories/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedRouterParamsMock.mockResolvedValue({
      slug: 'sleeping-bags'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should return category detail and keep enum options only for enum properties', async () => {
    const category = {
      id: 1,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags',

      properties: [{
        dataType: 'number',
        id: 11,
        name: 'Weight',
        slug: 'weight',
        unit: 'g',

        enumOptions: []
      }, {
        dataType: 'enum',
        id: 12,
        name: 'Fill Type',
        slug: 'fill-type',
        unit: null,

        enumOptions: [{
          id: 21,
          name: 'Down',
          slug: 'down'
        }]
      }]
    }

    const { dbHttp, findFirstMock } = createDetailDb(category)
    const event = createTestEvent(dbHttp)
    const result = await categoryDetailHandler(event)

    expect(result).toStrictEqual({
      id: 1,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags',

      properties: [{
        dataType: 'number',
        id: 11,
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      }, {
        dataType: 'enum',
        id: 12,
        name: 'Fill Type',
        slug: 'fill-type',
        unit: null,

        enumOptions: [{
          id: 21,
          name: 'Down',
          slug: 'down'
        }]
      }]
    })

    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })

  test('should return 400 when route params validation fails', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createDetailDb()
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(categoryDetailHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 404 when category slug does not exist', async () => {
    const { dbHttp } = createDetailDb()
    const event = createTestEvent(dbHttp)

    await expect(categoryDetailHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})
