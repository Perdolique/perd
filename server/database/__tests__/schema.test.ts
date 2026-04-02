import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as schema from '../schema'

interface RecordedQuery {
  params: unknown[];
  sql: string;
}

function createMockDatabase() {
  const queries: RecordedQuery[] = []

  const client = vi.fn((query: string, params: unknown[] = []) => {
    queries.push({
      params,
      sql: query
    })

    return {
      rows: []
    }
  })

  const db = drizzle({
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Drizzle expects a NeonQueryFunction, but this test only exercises the `query()` path
    client: client as never,
    schema
  })

  return {
    client,
    db,
    queries
  }
}

describe('equipmentItems updatedAt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should append updatedAt = now() to update queries without touching createdAt', async () => {
    const { client, db, queries } = createMockDatabase()

    await db
      .update(schema.equipmentItems)
      .set({
        name: 'Updated item name'
      })
      .where(eq(schema.equipmentItems.id, '0195f2d0-6f5a-7f20-8000-123456789abc'))
      .execute()

    expect(client).toHaveBeenCalledTimes(1)
    expect(queries).toHaveLength(1)

    const [query] = queries

    expect(query).toBeDefined()
    expect(query?.sql).toContain('"updatedAt" = now()')
    expect(query?.sql).not.toContain('"createdAt" =')

    expect(query?.params).toStrictEqual([
      'Updated item name',
      '0195f2d0-6f5a-7f20-8000-123456789abc'
    ])
  })
})
