import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { readMyGear } from '#server/utils/my-gear'
import { createTestEvent } from '~~/test-utils/create-test-event'

const catalogRow = {
  id: 'saved-id',
  createdAt: '2026-10-16T00:00:00Z',
  customName: null,
  personalName: 'My stove',
  measuredWeightGrams: '18.123456789123456789',
  note: 'Without the case',
  ownedQuantity: 2,
  itemId: 'catalog-id',
  itemName: 'Stove',
  brandName: 'Brand',
  brandSlug: 'brand',
  categoryName: 'Stoves',
  categorySlug: 'stoves',
  catalogWeightGrams: '20.2500'
} as const

function createDatabase(rows: unknown[]) {
  const orderBy = vi.fn((..._order: SQL[]) => rows)
  const where = vi.fn((_condition: SQL | undefined) => {return { orderBy }})

  const chain = {
    leftJoin: vi.fn((_table: unknown, _condition: SQL | undefined) => chain),
    where
  }

  const select = vi.fn(() => {return { from: vi.fn(() => chain) }})
  const event = createTestEvent({ select })

  return {
    database: event.context.dbHttp,
    select,
    chain,
    where,
    orderBy
  }
}

function query(condition: SQL | undefined) {
  if (condition === undefined) {
    throw new Error('Expected generated SQL')
  }

  const dialect = new PgDialect()

  return dialect.sqlToQuery(condition)
}

describe('private gear reading', () => {
  it('keeps personal and catalog values distinct, exact, and source-specific', async () => {
    const customRow = {
      ...catalogRow,
      id: 'custom-id',
      customName: 'DIY stove',
      personalName: null,
      itemId: null,
      measuredWeightGrams: '0',
      catalogWeightGrams: null
    }

    const { database } = createDatabase([catalogRow, customRow])
    const rows = await readMyGear(database, 'owner')

    expect(rows).toStrictEqual([{
      id: 'saved-id',
      createdAt: catalogRow.createdAt,
      personalName: 'My stove',
      measuredWeightGrams: '18.123456789123456789',
      note: 'Without the case',
      ownedQuantity: 2,
      source: 'catalog',

      item: {
        id: 'catalog-id',
        name: 'Stove',
        weightGrams: '20.25',

        brand: {
          name: 'Brand',
          slug: 'brand'
        },

        category: {
          name: 'Stoves',
          slug: 'stoves'
        }
      }
    }, {
      id: 'custom-id',
      createdAt: catalogRow.createdAt,
      customName: 'DIY stove',
      measuredWeightGrams: '0',
      note: 'Without the case',
      ownedQuantity: 2,
      source: 'custom'
    }])
  })

  it.each([
    {
      id: 'saved-id',
      operator: '=',
      params: ['owner', 'saved-id']
    },
    {
      id: ['saved-id', 'private-id'],
      operator: 'in',
      params: ['owner', 'saved-id', 'private-id']
    }
  ])('scopes reads to the owner and requested gear $id in one query with stable ordering', async ({ id, operator, params }) => {
    const { database, select, where, orderBy, chain } = createDatabase([])

    await readMyGear(database, 'owner', id)

    const filter = query(where.mock.calls[0]?.[0])
    const order = orderBy.mock.calls[0]?.map(query)
    const joins = chain.leftJoin.mock.calls.map(([, condition]) => query(condition))

    expect(select).toHaveBeenCalledTimes(1)
    expect(filter.sql).toContain('"user_equipment"."userId" =')
    expect(filter.sql).toContain(`"user_equipment"."id" ${operator}`)
    expect(filter.params).toStrictEqual(params)

    expect(order?.map((entry) => entry.sql)).toStrictEqual([
      '"user_equipment"."createdAt" desc',
      '"user_equipment"."id" desc'
    ])

    expect(joins[3]?.params).toStrictEqual(['weight', 'number', 'g'])
    expect(joins[3]?.sql).toContain('"category_properties"."categoryId" = "equipment_items"."categoryId"')
    expect(joins[4]?.sql).toContain('"item_property_values"."propertyId" = "category_properties"."id"')
  })

  it.each([null, '-1', 'NaN', 'Infinity', '-Infinity'])('does not treat invalid catalog weight %s as an available measurement', async (catalogWeightGrams) => {
    const { database } = createDatabase([{
      ...catalogRow,
      catalogWeightGrams
    }])

    const [row] = await readMyGear(database, 'owner')

    expect(row).toMatchObject({
      source: 'catalog',
      item: { weightGrams: null }
    })
  })
})
