import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import categoryDetailHandler from '#server/api/equipment/categories/by-slug/[slug].get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedRouteParamsMock
} = vi.hoisted(() => {
  return {
    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>()
  }
})

interface CategoryPropertyEnumOption {
  id: number;
  name: string;
  slug: string;
}

interface CategoryDetailProperty {
  allowsNegativeValues: boolean;
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
  propertiesRevision: number;
  slug: string;
}

interface CategoryPropertyColumns {
  allowsNegativeValues: boolean;
}

interface CategoryPropertyOrder {
  displayOrder: 'asc';
  id: 'asc';
}

interface CategoryPropertyEnumOptionQuery {
  columns: Record<keyof CategoryPropertyEnumOption, boolean>;
}

interface CategoryPropertyRelations {
  enumOptions: CategoryPropertyEnumOptionQuery;
}

interface CategoryPropertyQuery {
  columns: CategoryPropertyColumns;
  orderBy: CategoryPropertyOrder;
  with: CategoryPropertyRelations;
}

interface CategoryDetailRelations {
  properties: CategoryPropertyQuery;
}

interface CategoryDetailQuery {
  with: CategoryDetailRelations;
}

function createDetailDb(category?: CategoryDetail) {
  const findFirstMock = vi.fn((_query: CategoryDetailQuery) => category)

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

describe('get /api/equipment/categories/by-slug/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedRouteParamsMock.mockResolvedValue({
      slug: 'sleeping-bags'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return category detail and keep enum options only for enum properties', async () => {
    const category = {
      id: 1,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags',
      propertiesRevision: 0,

      properties: [{
        allowsNegativeValues: false,
        dataType: 'number',
        id: 11,
        name: 'Weight',
        slug: 'weight',
        unit: 'g',
        enumOptions: []
      }, {
        allowsNegativeValues: true,
        dataType: 'number',
        id: 13,
        name: 'Temperature rating',
        slug: 'temperature-rating',
        unit: '°C',
        enumOptions: []
      }, {
        allowsNegativeValues: false,
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
      propertiesRevision: 0,

      properties: [{
        allowsNegativeValues: false,
        dataType: 'number',
        id: 11,
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      }, {
        allowsNegativeValues: true,
        dataType: 'number',
        id: 13,
        name: 'Temperature rating',
        slug: 'temperature-rating',
        unit: '°C'
      }, {
        allowsNegativeValues: false,
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

    const query = findFirstMock.mock.calls[0]?.[0]

    expect(query?.with.properties.columns.allowsNegativeValues).toBe(true)

    expect(query?.with.properties.orderBy).toStrictEqual({
      displayOrder: 'asc',
      id: 'asc'
    })

    expect(query?.with.properties.with).toStrictEqual({
      enumOptions: {
        columns: {
          id: true,
          name: true,
          slug: true
        },

        orderBy: { id: 'asc' }
      }
    })
  })

  it('should return 400 when route params validation fails', async () => {
    const routeError = nuxtServer.createError({ status: 400 })
    const { dbHttp } = createDetailDb()
    const event = createTestEvent(dbHttp)

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(categoryDetailHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('should return 404 when category slug does not exist', async () => {
    const { dbHttp } = createDetailDb()
    const event = createTestEvent(dbHttp)

    await expect(categoryDetailHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {
  return {
    getValidatedRouteParams: getValidatedRouteParamsMock
  }
})
