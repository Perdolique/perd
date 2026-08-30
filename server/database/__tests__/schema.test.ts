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

describe('equipment item rejection reason', () => {
  it('should keep rejection reasons nullable and bounded to the shared limit', () => {
    const tableConfig = getTableConfig(schema.equipmentItems)

    const rejectionReasonColumn = tableConfig.columns.find(
      (column) => column.name === 'rejectionReason'
    )

    expect(rejectionReasonColumn?.notNull).toBe(false)
    expect(rejectionReasonColumn?.getSQLType()).toBe('varchar(256)')
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

  it('should keep ordered images linked to each item', () => {
    const tableConfig = getTableConfig(schema.equipmentItemImages)
    const columnNames = tableConfig.columns.map((column) => column.name)

    const cloudflareImageIdColumn = tableConfig.columns.find(
      (column) => column.name === 'cloudflareImageId'
    )

    const displayOrderColumn = tableConfig.columns.find(
      (column) => column.name === 'displayOrder'
    )

    const displayOrderConstraint = tableConfig.uniqueConstraints.find(
      (constraint) => constraint.getName() === schema.equipmentItemImageDisplayOrderConstraintName
    )

    const [itemForeignKey] = tableConfig.foreignKeys

    expect(columnNames).toStrictEqual([
      'id',
      'itemId',
      'cloudflareImageId',
      'displayOrder',
      'createdAt',
      'updatedAt'
    ])

    expect(cloudflareImageIdColumn?.isUnique).toBe(true)
    expect(displayOrderColumn?.notNull).toBe(true)

    expect(displayOrderConstraint?.columns.map((column) => column.name)).toStrictEqual([
      'itemId',
      'displayOrder'
    ])

    expect(tableConfig.checks.map((check) => check.name)).toContain(
      'equipment_item_images_displayOrder_check'
    )

    expect(itemForeignKey?.reference().foreignTable).toBe(schema.equipmentItems)
    expect(itemForeignKey?.onDelete).toBe('restrict')

    const equipmentItemColumnNames = getTableConfig(schema.equipmentItems)
      .columns
      .map((column) => column.name)

    expect(equipmentItemColumnNames).not.toContain('cloudflareImageId')
  })

  it('should keep pending photo submissions private and linked to their source', () => {
    const tableConfig = getTableConfig(schema.equipmentItemPhotoSubmissions)
    const columnNames = tableConfig.columns.map((column) => column.name)

    const cloudflareImageIdColumn = tableConfig.columns.find(
      (column) => column.name === 'cloudflareImageId'
    )

    const sourceUrlColumn = tableConfig.columns.find(
      (column) => column.name === 'sourceUrl'
    )

    const idempotencyKeyColumn = tableConfig.columns.find(
      (column) => column.name === 'idempotencyKey'
    )

    const idempotencyConstraint = tableConfig.uniqueConstraints.find(
      (constraint) => constraint.getName()
        === 'equipment_item_photo_submissions_createdBy_idempotencyKey_unique'
    )

    const historyIndex = getRequiredIndex(
      tableConfig,
      'equipment_item_photo_submissions_creator_history_index'
    )

    const statusColumn = tableConfig.columns.find(
      (column) => column.name === 'status'
    )

    const rejectionReasonColumn = tableConfig.columns.find(
      (column) => column.name === 'rejectionReason'
    )

    const itemForeignKey = tableConfig.foreignKeys.find(
      (foreignKey) => foreignKey.reference().foreignTable === schema.equipmentItems
    )

    const creatorForeignKey = tableConfig.foreignKeys.find(
      (foreignKey) => foreignKey.reference().foreignTable === schema.users
    )

    expect(columnNames).toStrictEqual([
      'id',
      'itemId',
      'idempotencyKey',
      'cloudflareImageId',
      'filename',
      'sourceType',
      'sourceUrl',
      'rightsConfirmed',
      'status',
      'rejectionReason',
      'createdBy',
      'createdAt',
      'updatedAt'
    ])

    expect(tableConfig.columns[0]?.getSQLType()).toBe('uuid')
    expect(idempotencyKeyColumn?.notNull).toBe(true)
    expect(idempotencyKeyColumn?.getSQLType()).toBe('uuid')

    expect(idempotencyConstraint?.columns.map((column) => column.name)).toStrictEqual([
      'createdBy',
      'idempotencyKey'
    ])

    expect(getIndexColumnNames(historyIndex)).toStrictEqual([
      'createdBy',
      'createdAt',
      'id'
    ])

    expect(cloudflareImageIdColumn?.isUnique).toBe(true)
    expect(sourceUrlColumn?.notNull).toBe(false)
    expect(sourceUrlColumn?.getSQLType()).toBe('varchar(2048)')
    expect(statusColumn?.default).toBe('pending')
    expect(rejectionReasonColumn?.notNull).toBe(false)
    expect(rejectionReasonColumn?.getSQLType()).toBe('varchar(256)')
    expect(itemForeignKey?.onDelete).toBe('restrict')
    expect(creatorForeignKey?.onDelete).toBe('set null')

    expect(tableConfig.checks.map((check) => check.name)).toContain(
      schema.equipmentItemPhotoSubmissionSourceConstraintName
    )
  })
})
