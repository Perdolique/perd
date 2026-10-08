import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

interface ItemRecord extends Record<string, unknown> {
  record: Record<string, unknown>;
}

interface IdRecord extends Record<string, unknown> {
  id: number;
}

interface SourceRecord extends Record<string, unknown> {
  sourceUrl: string | null;
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

      // Use only columns present in this historical schema, before later revision migrations.
      const brandRows = await database.execute<IdRecord>(sql`
        INSERT INTO brands (name, slug)
        VALUES ('Source migration test', 'source-migration-test') RETURNING id
      `)

      const categoryRows = await database.execute<IdRecord>(sql`
        INSERT INTO equipment_categories (name, slug)
        VALUES ('Source migration test', 'source-migration-test') RETURNING id
      `)

      const brand = required(brandRows.rows)
      const category = required(categoryRows.rows)

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

      const prefix = 'https://example.com/'
      const sourceUrl = `${prefix}${'a'.repeat(2048 - prefix.length)}`

      await database.execute(sql`
        INSERT INTO equipment_items ("brandId", "categoryId", name, status, "sourceUrl")
        VALUES (${brand.id}, ${category.id}, 'New source test', 'pending', ${sourceUrl}),
          (${brand.id}, ${category.id}, 'New source test', 'pending', NULL)
      `)

      const storedRows = await database.execute<SourceRecord>(sql`
        SELECT "sourceUrl" FROM equipment_items WHERE name = 'New source test'
      `)

      const storedItems = storedRows.rows

      expect(storedItems).toHaveLength(2)
      expect(storedItems).toStrictEqual(expect.arrayContaining([{ sourceUrl }, { sourceUrl: null }]))

      const overlongSource = `${sourceUrl}b`

      await expect(database.execute(sql`
        INSERT INTO equipment_items ("brandId", "categoryId", name, status, "sourceUrl")
        VALUES (${brand.id}, ${category.id}, 'New source test', 'pending', ${overlongSource})
      `)).rejects.toMatchObject({ cause: { code: '22001' } })
    } finally {
      await isolated.dispose()
    }
  })
})
