import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { brands, equipmentCategories, equipmentItems } from '#server/database/schema'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

interface ItemRecord extends Record<string, unknown> {
  record: Record<string, unknown>;
}

function required<Value>(rows: Value[]): Value {
  const [value] = rows

  if (value === undefined) {
    throw new Error('Expected a database row')
  }

  return value
}

describe('item submission source migration', () => {
  it('should preserve old items and store nullable source URLs up to 2048 characters after migration', async () => {
    const isolated = await createIsolatedPostgreSQL('item_submission_source', {
      beforeMigration: '20260922083228_item-submission-source-url'
    })

    try {
      const { database } = isolated

      const brandRows = await database.insert(brands)
        .values({
          name: 'Source migration test',
          slug: 'source-migration-test'
        })
        .returning({ id: brands.id })

      const categoryRows = await database.insert(equipmentCategories)
        .values({
          name: 'Source migration test',
          slug: 'source-migration-test'
        })
        .returning({ id: equipmentCategories.id })

      const brand = required(brandRows)
      const category = required(categoryRows)

      const legacyRows = await database.execute<ItemRecord>(sql`
        INSERT INTO equipment_items ("brandId", "categoryId", name, status)
        VALUES (${brand.id}, ${category.id}, 'Legacy source test', 'pending')
        RETURNING to_jsonb(equipment_items) AS record
      `)

      const legacy = required(legacyRows.rows)

      const migrationUrl = new URL(
        '../../server/database/migrations/20260922083228_item-submission-source-url/migration.sql',
        import.meta.url
      )

      const migrationSql = await readFile(migrationUrl, 'utf8')

      await database.execute(sql.raw(migrationSql))

      const migratedRows = await database.execute<ItemRecord>(sql`
        SELECT to_jsonb(equipment_items) AS record
        FROM equipment_items WHERE id = ${legacy.record.id}
      `)

      const migrated = required(migratedRows.rows)

      expect(migrated.record).toStrictEqual({
        ...legacy.record,
        sourceUrl: null
      })

      const item = {
        brandId: brand.id,
        categoryId: category.id,
        name: 'New source test',
        status: 'pending'
      }

      const prefix = 'https://example.com/'
      const sourceUrl = `${prefix}${'a'.repeat(2048 - prefix.length)}`

      await database.insert(equipmentItems).values([
        {
          ...item,
          sourceUrl
        },
        {
          ...item,
          sourceUrl: null
        }
      ])

      const storedItems = await database.query.equipmentItems.findMany({
        columns: {
          sourceUrl: true
        },

        where: {
          name: item.name
        }
      })

      expect(storedItems).toHaveLength(2)
      expect(storedItems).toStrictEqual(expect.arrayContaining([{ sourceUrl }, { sourceUrl: null }]))

      const overlongSource = `${sourceUrl}b`

      await expect(database.insert(equipmentItems).values({
        ...item,
        sourceUrl: overlongSource
      })).rejects.toMatchObject({ cause: { code: '22001' } })
    } finally {
      await isolated.dispose()
    }
  })
})
