import { describe, expect, it, vi } from 'vitest'
import categoryDetailHandler from '#server/api/equipment/categories/[slug].get'
import { createTestEvent } from '~~/test-utils/create-test-event'

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

function createDetailEvent(dbHttp: unknown, params?: Record<string, string>) {
  const event = createTestEvent(dbHttp)

  event.context.params = params ?? {
    slug: 'sleeping-bags'
  }

  return event
}

describe('get /api/equipment/categories/[slug]', () => {
  it('should return category detail and keep enum options only for enum properties', async () => {
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
    const event = createDetailEvent(dbHttp)
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

  it('should read the slug from id when mixed dynamic category routes share a path', async () => {
    const category = {
      id: 1,
      name: 'Sleeping Pads',
      slug: 'sleeping-pads',

      properties: []
    }

    const { dbHttp, findFirstMock } = createDetailDb(category)
    const event = createDetailEvent(dbHttp, {
      id: 'sleeping-pads'
    })
    const result = await categoryDetailHandler(event)

    expect(result).toStrictEqual({
      id: 1,
      name: 'Sleeping Pads',
      properties: [],
      slug: 'sleeping-pads'
    })

    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        slug: 'sleeping-pads'
      }
    }))
  })

  it('should return 400 when route params validation fails', async () => {
    const { dbHttp } = createDetailDb()
    const event = createDetailEvent(dbHttp, {
      slug: 'bad slug'
    })

    await expect(categoryDetailHandler(event)).rejects.toThrow(/Invalid/u)
  })

  it('should return 404 when category slug does not exist', async () => {
    const { dbHttp } = createDetailDb()
    const event = createDetailEvent(dbHttp)

    await expect(categoryDetailHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})
