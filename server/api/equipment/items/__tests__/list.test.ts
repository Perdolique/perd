import * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import listItemsHandler from '#server/api/equipment/items/index.get'
import type { validateItemsListQuery } from '#server/utils/validation/schemas'
import { createTestEvent } from '~~/test-utils/create-test-event'

type ItemsListQuery = ReturnType<typeof validateItemsListQuery>

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

function createQuery(overrides: Partial<ItemsListQuery> = {}) : ItemsListQuery {
  return {
    booleanFilter: [],
    brandSlug: [],
    categorySlug: undefined,
    direction: 'asc',
    enumFilter: [],
    limit: 20,
    numberFilter: [],
    page: 1,
    search: '',
    sort: 'name',
    ...overrides
  }
}

function createCategoryMetadata() {
  return {
    id: 2,

    properties: [{
      dataType: 'number',
      enumOptions: [],
      id: 10,
      slug: 'weight'
    }, {
      dataType: 'enum',
      enumOptions: [{ slug: 'canister' }, { slug: 'alcohol' }],
      id: 11,
      slug: 'fuel'
    }, {
      dataType: 'boolean',
      enumOptions: [],
      id: 12,
      slug: 'piezo'
    }]
  }
}

function createJoinChain(terminal: object) {
  const categoryJoinMock = vi.fn(() => terminal)
  const brandJoinMock = vi.fn(() => {
    return { innerJoin: categoryJoinMock }
  })

  return vi.fn(() => {
    return { innerJoin: brandJoinMock }
  })
}

function createListDb({
  categoryMetadata,
  definitions = [],
  enumOptions = [],
  items = [],
  total = 0,
  values = []
}: {
  categoryMetadata?: unknown;
  definitions?: unknown[];
  enumOptions?: unknown[];
  items?: unknown[];
  total?: number;
  values?: unknown[];
} = {}) {
  const itemsOffsetMock = vi.fn(() => items)
  const itemsLimitMock = vi.fn(() => {
    return { offset: itemsOffsetMock }
  })
  const itemsOrderByMock = vi.fn((..._conditions: SQL[]) => {
    return { limit: itemsLimitMock }
  })
  const itemsWhereMock = vi.fn((_condition: SQL | undefined) => {
    return { orderBy: itemsOrderByMock }
  })
  const itemsLeftJoinMock = vi.fn((_table: unknown, _condition: SQL | undefined) => {
    return { where: itemsWhereMock }
  })
  const itemsFromMock = createJoinChain({ leftJoin: itemsLeftJoinMock, where: itemsWhereMock })
  const countWhereMock = vi.fn((_condition: SQL | undefined) => [{ total }])
  const countFromMock = createJoinChain({ where: countWhereMock })
  const definitionsOrderByMock = vi.fn((..._conditions: SQL[]) => definitions)
  const definitionsWhereMock = vi.fn(() => {
    return { orderBy: definitionsOrderByMock }
  })
  const definitionsFromMock = vi.fn(() => {
    return { where: definitionsWhereMock }
  })
  const enumOptionsWhereMock = vi.fn(() => enumOptions)
  const enumOptionsInnerJoinMock = vi.fn(() => {
    return { where: enumOptionsWhereMock }
  })
  const enumOptionsFromMock = vi.fn(() => {
    return { innerJoin: enumOptionsInnerJoinMock }
  })
  const valuesWhereMock = vi.fn(() => values)
  const valuesFromMock = vi.fn(() => {
    return { where: valuesWhereMock }
  })
  const findFirstMock = vi.fn(() => categoryMetadata)
  const selectMock = vi.fn((selection: Record<string, unknown>) => {
    if ('total' in selection) {
      return { from: countFromMock }
    }

    if ('displayOrder' in selection) {
      return { from: definitionsFromMock }
    }

    if ('itemId' in selection) {
      return { from: valuesFromMock }
    }

    if ('propertyId' in selection) {
      return { from: enumOptionsFromMock }
    }

    return { from: itemsFromMock }
  })

  return {
    dbHttp: {
      query: {
        equipmentCategories: {
          findFirst: findFirstMock
        }
      },
      select: selectMock
    },
    countWhereMock,
    definitionsOrderByMock,
    findFirstMock,
    itemsLeftJoinMock,
    itemsLimitMock,
    itemsOffsetMock,
    itemsOrderByMock,
    itemsWhereMock,
    selectMock
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

describe('get /api/equipment/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getValidatedQueryMock.mockResolvedValue(createQuery())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return paginated rows enriched with three ordered typed properties', async () => {
    const id = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    const secondId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
    const itemRows = [{
      categoryId: 2,
      id,
      name: 'PocketRocket Deluxe',
      brand: { name: 'MSR', slug: 'msr' },
      category: { name: 'Stoves', slug: 'stoves' }
    }, {
      categoryId: 3,
      id: secondId,
      name: 'Solo Pot',
      brand: { name: 'Solo', slug: 'solo' },
      category: { name: 'Cookware', slug: 'cookware' }
    }]
    const definitions = [
      { categoryId: 2, dataType: 'number', displayOrder: 0, id: 10, name: 'Weight', slug: 'weight', unit: 'g' },
      { categoryId: 2, dataType: 'boolean', displayOrder: 1, id: 12, name: 'Piezo', slug: 'piezo', unit: null },
      { categoryId: 2, dataType: 'enum', displayOrder: 2, id: 11, name: 'Fuel', slug: 'fuel', unit: null },
      { categoryId: 2, dataType: 'text', displayOrder: 3, id: 13, name: 'Notes', slug: 'notes', unit: null },
      { categoryId: 3, dataType: 'number', displayOrder: 0, id: 20, name: 'Volume', slug: 'volume', unit: 'ml' }
    ]
    const enumOptions = [
      { name: 'Liquid fuel', propertyId: 11, slug: 'liquid-fuel' }
    ]
    const values = [
      { itemId: id, propertyId: 10, valueBoolean: null, valueNumber: '83', valueText: null },
      { itemId: id, propertyId: 12, valueBoolean: true, valueNumber: null, valueText: null },
      { itemId: id, propertyId: 11, valueBoolean: null, valueNumber: null, valueText: 'liquid-fuel' }
    ]
    const db = createListDb({ definitions, enumOptions, items: itemRows, total: 42, values })
    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockResolvedValue(createQuery({ limit: 10, page: 2 }))

    const result = await listItemsHandler(event)

    expect(result).toStrictEqual({
      items: [{
        id,
        name: 'PocketRocket Deluxe',
        brand: { name: 'MSR', slug: 'msr' },
        category: { name: 'Stoves', slug: 'stoves' },

        properties: [
          { dataType: 'number', name: 'Weight', slug: 'weight', unit: 'g', value: 83 },
          { dataType: 'boolean', name: 'Piezo', slug: 'piezo', unit: null, value: true },
          {
            dataType: 'enum',
            enumOptionName: 'Liquid fuel',
            name: 'Fuel',
            slug: 'fuel',
            unit: null,
            value: 'liquid-fuel'
          }
        ]
      }, {
        id: secondId,
        name: 'Solo Pot',
        brand: { name: 'Solo', slug: 'solo' },
        category: { name: 'Cookware', slug: 'cookware' },

        properties: [
          { dataType: 'number', name: 'Volume', slug: 'volume', unit: 'ml', value: null }
        ]
      }],
      limit: 10,
      page: 2,
      total: 42
    })
    expect(db.itemsLimitMock).toHaveBeenCalledWith(10)
    expect(db.itemsOffsetMock).toHaveBeenCalledWith(10)
    expect(db.definitionsOrderByMock).toHaveBeenCalledTimes(1)
    const [definitionOrderFragments] = db.definitionsOrderByMock.mock.calls

    expect(definitionOrderFragments?.map((fragment) => compactSql(fragment))).toStrictEqual([
      '"category_properties"."categoryId" asc',
      '"category_properties"."displayOrder" asc',
      '"category_properties"."id" asc'
    ])
    expect(db.selectMock).toHaveBeenCalledTimes(5)
    expect(db.countWhereMock.mock.calls[0]?.[0]).toBe(db.itemsWhereMock.mock.calls[0]?.[0])
  })

  it('should preserve an enum slug when its display name is unavailable', async () => {
    const id = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    const itemRows = [{
      categoryId: 2,
      id,
      name: 'PocketRocket Deluxe',
      brand: { name: 'MSR', slug: 'msr' },
      category: { name: 'Stoves', slug: 'stoves' }
    }]
    const definitions = [
      { categoryId: 2, dataType: 'enum', displayOrder: 0, id: 11, name: 'Fuel', slug: 'fuel', unit: null }
    ]
    const values = [
      { itemId: id, propertyId: 11, valueBoolean: null, valueNumber: null, valueText: 'legacy-fuel' }
    ]
    const db = createListDb({ definitions, items: itemRows, values })
    const event = createTestEvent(db.dbHttp)

    const result = await listItemsHandler(event)

    expect(result.items[0]?.properties).toStrictEqual([{
      dataType: 'enum',
      name: 'Fuel',
      slug: 'fuel',
      unit: null,
      value: 'legacy-fuel'
    }])
  })

  it('should compile grouped search, brand, enum, numeric, and boolean predicates', async () => {
    const db = createListDb({ categoryMetadata: createCategoryMetadata() })
    const query = createQuery({
      booleanFilter: [{ propertySlug: 'piezo', value: true }],
      brandSlug: ['msr', 'therm-a-rest'],
      categorySlug: 'stoves',
      enumFilter: [
        { optionSlug: 'canister', propertySlug: 'fuel' },
        { optionSlug: 'alcohol', propertySlug: 'fuel' }
      ],
      numberFilter: [{
        max: '9007199254740993',
        min: '0.10000000000000001',
        propertySlug: 'weight'
      }],
      search: String.raw`Neo\%_`
    })

    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockResolvedValue(query)

    await listItemsHandler(event)

    const where = db.itemsWhereMock.mock.calls[0]?.[0]
    const compiled = compileSql(where)
    const statement = compiled.sql.replaceAll(/\s+/gu, ' ')
    const escapedSearch = String.raw`%Neo\\\%\_%`

    expect(compiled.params).toStrictEqual(expect.arrayContaining([
      'approved',
      'stoves',
      'msr',
      'therm-a-rest',
      escapedSearch,
      10,
      '0.10000000000000001',
      '9007199254740993',
      11,
      'canister',
      'alcohol',
      12,
      true
    ]))
    expect(compiled.params.filter((parameter) => parameter === escapedSearch)).toHaveLength(3)
    expect(statement.match(/exists \(/gu)).toHaveLength(3)
    expect(statement).toContain('"valueNumber" >=')
    expect(statement).toContain('"valueNumber" <=')
    expect(statement).toMatch(/\("filter_values"\."valueText" = \$\d+\) or \("filter_values"\."valueText" = \$\d+\)/u)
    expect(statement).toMatch(/\("brands"\."slug" = \$\d+\) or \("brands"\."slug" = \$\d+\)/u)
    expect(statement).toContain('"equipment_items"."name" ilike')
    expect(statement).toContain('"brands"."name" ilike')
    expect(statement).toContain('"equipment_categories"."name" ilike')
    expect(statement).toMatch(
      /^\(\("equipment_items"\."status" = \$\d+\) and \("equipment_categories"\."slug" = \$\d+\) and /u
    )
    expect(statement).toMatch(
      /"brands"\."slug" = \$\d+\)\)\) and \(\(\("equipment_items"\."name" ilike/u
    )
    expect(statement.match(/\)+ and \(exists \(/gu)).toHaveLength(3)
  })

  it.each(['asc', 'desc'] as const)(
    'should left join numeric %s sorting with nulls last and stable tie-breakers',
    async (direction) => {
      const db = createListDb({ categoryMetadata: createCategoryMetadata() })
      const query = createQuery({
        categorySlug: 'stoves',
        direction,
        sort: 'property:weight'
      })
      const event = createTestEvent(db.dbHttp)

      getValidatedQueryMock.mockResolvedValue(query)

      await listItemsHandler(event)

      const joinCondition = db.itemsLeftJoinMock.mock.calls[0]?.[1]
      const [orderFragments] = db.itemsOrderByMock.mock.calls

      expect(db.itemsLeftJoinMock).toHaveBeenCalledTimes(1)
      expect(compileSql(joinCondition).params).toContain(10)
      expect(orderFragments?.map((fragment) => compactSql(fragment))).toStrictEqual([
        `"property_sort_values"."valueNumber" ${direction} nulls last`,
        '"equipment_items"."name" asc',
        '"equipment_items"."id" asc'
      ])
    }
  )

  it.each([
    ['name', 'desc', ['"equipment_items"."name" desc', '"equipment_items"."id" asc']],
    ['brand', 'desc', ['"brands"."name" desc', '"equipment_items"."name" asc', '"equipment_items"."id" asc']]
  ] as const)('should stabilize %s sorting', async (sort, direction, expectedOrder) => {
    const db = createListDb()
    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockResolvedValue(createQuery({ direction, sort }))

    await listItemsHandler(event)

    const [orderFragments] = db.itemsOrderByMock.mock.calls

    expect(orderFragments?.map((fragment) => compactSql(fragment))).toStrictEqual(expectedOrder)
  })

  it.each([
    ['unknown category', undefined, createQuery({ categorySlug: 'unknown', numberFilter: [{ min: '1', max: null, propertySlug: 'weight' }] })],
    ['wrong data type', createCategoryMetadata(), createQuery({ categorySlug: 'stoves', numberFilter: [{ min: '1', max: null, propertySlug: 'fuel' }] })],
    ['unknown property', createCategoryMetadata(), createQuery({ categorySlug: 'stoves', numberFilter: [{ min: '1', max: null, propertySlug: 'capacity' }] })],
    ['unknown enum option', createCategoryMetadata(), createQuery({ categorySlug: 'stoves', enumFilter: [{ optionSlug: 'gasoline', propertySlug: 'fuel' }] })],
    ['non-numeric property sort', createCategoryMetadata(), createQuery({ categorySlug: 'stoves', sort: 'property:fuel' })]
  ])('should reject %s metadata', async (_name, categoryMetadata, query) => {
    const db = createListDb({ categoryMetadata })
    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockResolvedValue(query)

    await expect(listItemsHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('should keep unknown brand and category slugs as zero-match SQL filters', async () => {
    const db = createListDb()
    const query = createQuery({ brandSlug: ['unknown-brand'], categorySlug: 'unknown-category' })
    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockResolvedValue(query)

    await listItemsHandler(event)

    const compiled = compileSql(db.itemsWhereMock.mock.calls[0]?.[0])

    expect(compiled.params).toStrictEqual(expect.arrayContaining(['unknown-brand', 'unknown-category']))
    expect(db.findFirstMock).not.toHaveBeenCalled()
  })

  it('should stop before database queries when query validation fails', async () => {
    const db = createListDb()
    const event = createTestEvent(db.dbHttp)

    getValidatedQueryMock.mockRejectedValue(h3.createError({ status: 400 }))

    await expect(listItemsHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(db.selectMock).not.toHaveBeenCalled()
  })
})
