import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'

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
