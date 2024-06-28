import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

export const tables = schema

export function useDrizzle() {
  return drizzle(hubDatabase(), { schema })
}

export type User = typeof schema.users.$inferSelect
export { sql, eq, and, or } from 'drizzle-orm'