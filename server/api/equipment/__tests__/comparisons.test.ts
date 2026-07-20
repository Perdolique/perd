import * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import comparisonsHandler from '#server/api/equipment/comparisons.get'
import type { validateEquipmentComparisonQuery } from '#server/utils/validation/schemas'
import { createTestEvent } from '~~/test-utils/create-test-event'

type EquipmentComparisonQuery = ReturnType<typeof validateEquipmentComparisonQuery>

const firstItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const secondItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const thirdItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const fourthItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'

const comparisonItemIds = [firstItemId, secondItemId, thirdItemId, fourthItemId]

const { getValidatedQueryMock } = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    }
  }
})

function createQuery(itemId: string[] = comparisonItemIds) : EquipmentComparisonQuery {
  return { itemId }
}

function createItemRow(id: string, categoryId = 2) {
  return {
    id,
    name: `Item ${id.at(-1)}`,
    brand: {
      name: `Brand ${id.at(-1)}`,
      slug: `brand-${id.at(-1)}`
    },
    category: {
      id: categoryId,
      name: categoryId === 2 ? 'Stoves' : 'Cookware',
      slug: categoryId === 2 ? 'stoves' : 'cookware'
    }
  }
}

function createComparisonDb({
  definitions = [],
  enumOptions = [],
  items = [],
  values = []
}: {
  definitions?: unknown[];
  enumOptions?: unknown[];
  items?: unknown[];
  values?: unknown[];
} = {}) {
  const itemsWhereMock = vi.fn((_condition: SQL | undefined) => items)

  const itemsCategoryJoinMock = vi.fn(() => {
    return { where: itemsWhereMock }
  })

  const itemsBrandJoinMock = vi.fn(() => {
    return { innerJoin: itemsCategoryJoinMock }
  })

  const itemsFromMock = vi.fn(() => {
    return { innerJoin: itemsBrandJoinMock }
  })

  const definitionsOrderByMock = vi.fn((..._conditions: SQL[]) => definitions)

  const definitionsWhereMock = vi.fn(() => {
    return { orderBy: definitionsOrderByMock }
  })

  const definitionsFromMock = vi.fn(() => {
    return { where: definitionsWhereMock }
  })

  const valuesWhereMock = vi.fn((_condition: SQL | undefined) => values)

  const valuesInnerJoinMock = vi.fn(() => {
    return { where: valuesWhereMock }
  })

  const valuesFromMock = vi.fn(() => {
    return { innerJoin: valuesInnerJoinMock }
  })

  const enumOptionsWhereMock = vi.fn((_condition: SQL | undefined) => enumOptions)

  const enumOptionsInnerJoinMock = vi.fn(() => {
    return { where: enumOptionsWhereMock }
  })

  const enumOptionsFromMock = vi.fn(() => {
    return { innerJoin: enumOptionsInnerJoinMock }
  })

  const selectMock = vi.fn((selection: Record<string, unknown>) => {
    if ('brand' in selection) {
      return { from: itemsFromMock }
    }

    if ('displayOrder' in selection) {
      return { from: definitionsFromMock }
    }

    if ('valueBoolean' in selection) {
      return { from: valuesFromMock }
    }

    return { from: enumOptionsFromMock }
  })

  return {
    dbHttp: {
      select: selectMock
    },
    definitionsOrderByMock,
    enumOptionsWhereMock,
    itemsWhereMock,
    selectMock,
    valuesWhereMock
  }
}

function compileSql(value: SQL | undefined) {
  if (value === undefined) {
    throw new Error('Expected a defined SQL fragment')
  }

  const dialect = new PgDialect()

  return dialect.sqlToQuery(value)
}

function compactSql(value: SQL | undefined) {
  return compileSql(value).sql.replaceAll(/\s+/gu, ' ').trim()
}

describe('get /api/equipment/comparisons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getValidatedQueryMock.mockResolvedValue(createQuery())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([2, 3, 4])('should return an ordered comparison for %i approved items', async (itemCount) => {
    const itemIds = comparisonItemIds.slice(0, itemCount)
    const itemRows = itemIds.map((itemId) => createItemRow(itemId)).toReversed()
    const { dbHttp } = createComparisonDb({ items: itemRows })
    const event = createTestEvent(dbHttp)

    getValidatedQueryMock.mockResolvedValue(createQuery(itemIds))

    const result = await comparisonsHandler(event)

    expect(result.category).toStrictEqual({ id: 2, name: 'Stoves', slug: 'stoves' })
    expect(result.items.map((item) => item.id)).toStrictEqual(itemIds)
    expect(result.properties).toStrictEqual([])
  })

  it('should return every ordered typed value with enum display fallbacks', async () => {
    const itemRows = [
      createItemRow(thirdItemId),
      createItemRow(firstItemId),
      createItemRow(fourthItemId),
      createItemRow(secondItemId)
    ]

    const definitions = [{
      dataType: 'number',
      displayOrder: 0,
      id: 10,
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    }, {
      dataType: 'text',
      displayOrder: 1,
      id: 11,
      name: 'Notes',
      slug: 'notes',
      unit: null
    }, {
      dataType: 'boolean',
      displayOrder: 2,
      id: 12,
      name: 'Piezo',
      slug: 'piezo',
      unit: null
    }, {
      dataType: 'enum',
      displayOrder: 3,
      id: 13,
      name: 'Fuel',
      slug: 'fuel',
      unit: null
    }]

    const values = [{
      itemId: firstItemId,
      propertyId: 10,
      valueBoolean: null,
      valueNumber: '83.5',
      valueText: null
    }, {
      itemId: thirdItemId,
      propertyId: 10,
      valueBoolean: null,
      valueNumber: '100',
      valueText: null
    }, {
      itemId: firstItemId,
      propertyId: 11,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'three-season'
    }, {
      itemId: fourthItemId,
      propertyId: 11,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'compact'
    }, {
      itemId: firstItemId,
      propertyId: 12,
      valueBoolean: true,
      valueNumber: null,
      valueText: null
    }, {
      itemId: secondItemId,
      propertyId: 12,
      valueBoolean: false,
      valueNumber: null,
      valueText: null
    }, {
      itemId: fourthItemId,
      propertyId: 12,
      valueBoolean: true,
      valueNumber: null,
      valueText: null
    }, {
      itemId: firstItemId,
      propertyId: 13,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'canister'
    }, {
      itemId: secondItemId,
      propertyId: 13,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'legacy-fuel'
    }, {
      itemId: thirdItemId,
      propertyId: 13,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'alcohol'
    }]

    const enumOptions = [{ name: 'Canister', propertyId: 13, slug: 'canister' }, {
      name: 'Alcohol',
      propertyId: 13,
      slug: 'alcohol'
    }]

    const {
      dbHttp,
      definitionsOrderByMock,
      enumOptionsWhereMock,
      itemsWhereMock,
      selectMock,
      valuesWhereMock
    } = createComparisonDb({ definitions, enumOptions, items: itemRows, values })
    const event = createTestEvent(dbHttp)
    const result = await comparisonsHandler(event)

    expect(result).toStrictEqual({
      category: {
        id: 2,
        name: 'Stoves',
        slug: 'stoves'
      },

      items: comparisonItemIds.map((itemId) => {
        return {
          id: itemId,
          name: `Item ${itemId.at(-1)}`,
          brand: {
            name: `Brand ${itemId.at(-1)}`,
            slug: `brand-${itemId.at(-1)}`
          }
        }
      }),

      properties: [{
        dataType: 'number',
        id: 10,
        name: 'Weight',
        slug: 'weight',
        unit: 'g',
        values: [
          { itemId: firstItemId, value: 83.5 },
          { itemId: secondItemId, value: null },
          { itemId: thirdItemId, value: 100 },
          { itemId: fourthItemId, value: null }
        ]
      }, {
        dataType: 'text',
        id: 11,
        name: 'Notes',
        slug: 'notes',
        unit: null,
        values: [
          { itemId: firstItemId, value: 'three-season' },
          { itemId: secondItemId, value: null },
          { itemId: thirdItemId, value: null },
          { itemId: fourthItemId, value: 'compact' }
        ]
      }, {
        dataType: 'boolean',
        id: 12,
        name: 'Piezo',
        slug: 'piezo',
        unit: null,
        values: [
          { itemId: firstItemId, value: true },
          { itemId: secondItemId, value: false },
          { itemId: thirdItemId, value: null },
          { itemId: fourthItemId, value: true }
        ]
      }, {
        dataType: 'enum',
        id: 13,
        name: 'Fuel',
        slug: 'fuel',
        unit: null,
        values: [{ enumOptionName: 'Canister', itemId: firstItemId, value: 'canister' }, {
          itemId: secondItemId,
          value: 'legacy-fuel'
        }, {
          enumOptionName: 'Alcohol',
          itemId: thirdItemId,
          value: 'alcohol'
        }, {
          itemId: fourthItemId,
          value: null
        }]
      }]
    })

    expect(selectMock).toHaveBeenCalledTimes(4)
    expect(valuesWhereMock).toHaveBeenCalledTimes(1)
    expect(enumOptionsWhereMock).toHaveBeenCalledTimes(1)

    const [itemWhereCall] = itemsWhereMock.mock.calls
    const itemWhere = itemWhereCall?.[0]
    const compiledItemWhere = compileSql(itemWhere)

    expect(compiledItemWhere.sql).toContain('"equipment_items"."status" =')
    expect(compiledItemWhere.params).toStrictEqual(['approved', ...comparisonItemIds])

    const [orderByCall] = definitionsOrderByMock.mock.calls
    const orderStatements = orderByCall?.map((condition) => compactSql(condition))

    expect(orderStatements).toStrictEqual([
      '"category_properties"."displayOrder" asc',
      '"category_properties"."id" asc'
    ])
  })

  it('should return 404 before enrichment when an approved item cannot be loaded', async () => {
    const itemIds = [firstItemId, secondItemId]

    const { dbHttp, selectMock } = createComparisonDb({
      items: [createItemRow(firstItemId)]
    })
    const event = createTestEvent(dbHttp)

    getValidatedQueryMock.mockResolvedValue(createQuery(itemIds))

    await expect(comparisonsHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
    expect(selectMock).toHaveBeenCalledTimes(1)
  })

  it('should return 400 before enrichment for mixed categories', async () => {
    const itemIds = [firstItemId, secondItemId]
    const { dbHttp, selectMock } = createComparisonDb({
      items: [createItemRow(firstItemId), createItemRow(secondItemId, 3)]
    })
    const event = createTestEvent(dbHttp)

    getValidatedQueryMock.mockResolvedValue(createQuery(itemIds))

    await expect(comparisonsHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
    expect(selectMock).toHaveBeenCalledTimes(1)
  })

  it('should return 400 without querying the database when query validation fails', async () => {
    const validationError = h3.createError({ status: 400 })
    const { dbHttp, selectMock } = createComparisonDb()
    const event = createTestEvent(dbHttp)

    getValidatedQueryMock.mockRejectedValue(validationError)

    await expect(comparisonsHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
    expect(selectMock).not.toHaveBeenCalled()
  })
})
