import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'

function getIndexColumnNames(tableIndex: ReturnType<typeof getTableConfig>['indexes'][number]) {
  return tableIndex.config.columns.map((column) => {
    if ('name' in column) {
      return column.name
    }

    throw new Error('Expected an indexed table column')
  })
}

function getRequiredIndex(tableConfig: ReturnType<typeof getTableConfig>, indexName: string) {
  const tableIndex = tableConfig.indexes.find((index) => index.config.name === indexName)

  if (tableIndex === undefined) {
    throw new Error(`Missing index ${indexName}`)
  }

  return tableIndex
}

describe('equipmentItems updatedAt', () => {
  it('should append updatedAt = now() to update queries without touching createdAt', () => {
    const db = drizzle.mock()

    const query = db
      .update(schema.equipmentItems)
      .set({
        name: 'Updated item name'
      })
      .where(eq(schema.equipmentItems.id, '0195f2d0-6f5a-7f20-8000-123456789abc'))
      .toSQL()

    expect(query).toBeDefined()
    expect(query.sql).toContain('"updatedAt" = now()')
    expect(query.sql).not.toContain('"createdAt" =')

    expect(query.params).toStrictEqual([
      'Updated item name',
      '0195f2d0-6f5a-7f20-8000-123456789abc'
    ])
  })
})

describe('equipment catalog research schema', () => {
  it('should require a unique display order within each category', () => {
    const tableConfig = getTableConfig(schema.categoryProperties)
    const displayOrderColumn = tableConfig.columns.find((column) => column.name === 'displayOrder')
    const displayOrderConstraint = tableConfig.uniqueConstraints.find(
      (constraint) => constraint.getName() === schema.categoryPropertyDisplayOrderConstraintName
    )

    expect(displayOrderColumn?.notNull).toBe(true)
    expect(displayOrderConstraint?.columns.map((column) => column.name)).toStrictEqual([
      'categoryId',
      'displayOrder'
    ])
  })

  it('should index each typed property value by property and item', () => {
    const tableConfig = getTableConfig(schema.itemPropertyValues)
    const indexes = tableConfig.indexes.map((tableIndex) => {
      return {
        columns: getIndexColumnNames(tableIndex),
        name: tableIndex.config.name
      }
    })

    expect(indexes).toStrictEqual(expect.arrayContaining([{
      columns: ['propertyId', 'valueNumber', 'itemId'],
      name: 'item_property_values_property_number_index'
    }, {
      columns: ['propertyId', 'valueText', 'itemId'],
      name: 'item_property_values_property_text_index'
    }, {
      columns: ['propertyId', 'valueBoolean', 'itemId'],
      name: 'item_property_values_property_boolean_index'
    }]))
  })

  it('should index approved items by category and brand', () => {
    const tableConfig = getTableConfig(schema.equipmentItems)
    const approvedItemIndex = getRequiredIndex(tableConfig, 'equipment_items_approved_category_brand_index')
    const indexColumns = getIndexColumnNames(approvedItemIndex)

    expect(indexColumns).toStrictEqual(['categoryId', 'brandId'])
    expect(approvedItemIndex.config.where).toBeDefined()
  })
})
