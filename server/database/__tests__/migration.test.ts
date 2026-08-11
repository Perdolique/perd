import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const databaseMigrationWorkflowUrl = new URL(
  '../../../.github/workflows/database-migration.yml',
  import.meta.url
)
const databaseMigrationWorkflow = readFileSync(databaseMigrationWorkflowUrl, 'utf8')
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
const negativeValuesMigrationUrl = new URL(
  '../migrations/20260808152209_stiff_ultragirl/migration.sql',
  import.meta.url
)
const negativeValuesMigrationSql = readFileSync(negativeValuesMigrationUrl, 'utf8')
const rejectionReasonMigrationUrl = new URL(
  '../migrations/20260810183449_add-item-submission-rejection-reason/migration.sql',
  import.meta.url
)
const rejectionReasonMigrationSql = readFileSync(rejectionReasonMigrationUrl, 'utf8')

describe('database migration workflow', () => {
  it('should migrate pull request databases without resetting catalog data', () => {
    expect(databaseMigrationWorkflow).toContain('pull_request:')
    expect(databaseMigrationWorkflow).toContain('pnpm run db:migrate')
    expect(databaseMigrationWorkflow).not.toContain('db:seed')
    expect(databaseMigrationWorkflow).not.toContain('db:reset:catalog')
  })
})

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

describe('category property negative value migration', () => {
  it('should forbid negative values by default and preserve temperature ratings', () => {
    const addColumnPosition = negativeValuesMigrationSql.indexOf(
      'ADD COLUMN "allowsNegativeValues" boolean DEFAULT false NOT NULL'
    )
    const temperatureUpdatePosition = negativeValuesMigrationSql.indexOf(
      'SET "allowsNegativeValues" = true'
    )

    expect(addColumnPosition).toBeGreaterThanOrEqual(0)
    expect(temperatureUpdatePosition).toBeGreaterThan(addColumnPosition)
    expect(negativeValuesMigrationSql).toContain('property."categoryId" = category.id')
    expect(negativeValuesMigrationSql).toContain("category.slug = 'sleeping-bags'")
    expect(negativeValuesMigrationSql).toContain("property.slug = 'temperature-rating'")
  })

  it('should preserve equipment items and their images', () => {
    expect(negativeValuesMigrationSql).not.toMatch(
      /(?:CREATE|DROP|TRUNCATE) TABLE (?:IF (?:NOT )?EXISTS )?"equipment_items"/iu
    )
    expect(negativeValuesMigrationSql).not.toMatch(
      /DELETE FROM "equipment_items"/iu
    )
    expect(negativeValuesMigrationSql).not.toMatch(
      /(?:CREATE|DROP|TRUNCATE) TABLE (?:IF (?:NOT )?EXISTS )?"equipment_item_images"/iu
    )
    expect(negativeValuesMigrationSql).not.toMatch(
      /DELETE FROM "equipment_item_images"/iu
    )
  })
})

describe('equipment item rejection reason migration', () => {
  it('should add a nullable bounded column without rebuilding equipment items', () => {
    expect(rejectionReasonMigrationSql).toContain(
      'ALTER TABLE "equipment_items" ADD COLUMN "rejectionReason" varchar(256);'
    )
    expect(rejectionReasonMigrationSql).not.toMatch(
      /(?:CREATE|DROP|TRUNCATE) TABLE (?:IF (?:NOT )?EXISTS )?"equipment_items"/iu
    )
    expect(rejectionReasonMigrationSql).not.toMatch(/DELETE FROM "equipment_items"/iu)
    expect(rejectionReasonMigrationSql).not.toContain('NOT NULL')
  })
})
