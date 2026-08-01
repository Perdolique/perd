import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL(
  '../migrations/20260711222621_stormy_captain_marvel/migration.sql',
  import.meta.url
)
const migrationSql = readFileSync(migrationUrl, 'utf8')
const imagesMigrationUrl = new URL(
  '../migrations/20260730184011_uneven_karma/migration.sql',
  import.meta.url
)
const imagesMigrationSql = readFileSync(imagesMigrationUrl, 'utf8')

describe('category property display order migration', () => {
  it('should backfill a zero-based order before making the column required', () => {
    const addColumnStatement = 'ALTER TABLE "category_properties" ADD COLUMN "displayOrder" integer;'
    const setNotNullStatement = 'ALTER TABLE "category_properties" ALTER COLUMN "displayOrder" SET NOT NULL;'
    const uniqueConstraintStatement = 'CONSTRAINT "category_properties_categoryId_displayOrder_unique"'
    const addColumnPosition = migrationSql.indexOf(addColumnStatement)
    const backfillPosition = migrationSql.indexOf('WITH ordered_properties AS')
    const setNotNullPosition = migrationSql.indexOf(setNotNullStatement)
    const uniqueConstraintPosition = migrationSql.indexOf(uniqueConstraintStatement)

    expect(addColumnPosition).toBeGreaterThanOrEqual(0)
    expect(backfillPosition).toBeGreaterThan(addColumnPosition)
    expect(setNotNullPosition).toBeGreaterThan(backfillPosition)
    expect(uniqueConstraintPosition).toBeGreaterThan(setNotNullPosition)
    expect(migrationSql).toMatch(/row_number\(\) OVER \(PARTITION BY "categoryId" ORDER BY "id"\) - 1\)::integer/u)
  })

  it('should enforce unique order and add the confirmed research indexes', () => {
    expect(migrationSql).toContain(
      'CONSTRAINT "category_properties_categoryId_displayOrder_unique" UNIQUE("categoryId","displayOrder")'
    )

    expect(migrationSql).toContain(
      'INDEX "equipment_items_approved_category_brand_index" ON "equipment_items" ("categoryId","brandId") WHERE "status" = \'approved\''
    )

    expect(migrationSql).toContain(
      'INDEX "item_property_values_property_number_index" ON "item_property_values" ("propertyId","valueNumber","itemId")'
    )

    expect(migrationSql).toContain(
      'INDEX "item_property_values_property_text_index" ON "item_property_values" ("propertyId","valueText","itemId")'
    )

    expect(migrationSql).toContain(
      'INDEX "item_property_values_property_boolean_index" ON "item_property_values" ("propertyId","valueBoolean","itemId")'
    )
  })
})

describe('equipment item image migration', () => {
  it('should create the final equipment item image table', () => {
    expect(imagesMigrationSql).toContain('CREATE TABLE "equipment_item_images"')
    expect(imagesMigrationSql).toContain('"equipment_item_images_itemId_displayOrder_unique"')
    expect(imagesMigrationSql).toContain('"equipment_item_images_displayOrder_check"')
    expect(imagesMigrationSql).toContain('ON DELETE RESTRICT')
  })
})
