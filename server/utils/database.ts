import { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

export const tables = schema

export function createDrizzle(db: D1Database) {
  const drizzleDb = drizzle(db, {
    schema,
    logger: true
  })

  return drizzleDb
}
