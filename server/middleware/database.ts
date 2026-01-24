import { defineEventHandler } from 'h3'
import { createDrizzle, tables, relations } from '#server/utils/database'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

export default defineEventHandler(async ({ context }) => {
  if (context.db === undefined) {
    const drizzleDb = createDrizzle()

    context.db = drizzleDb
  }
})

declare module 'h3' {
  interface H3EventContext {
    db: NeonHttpDatabase<typeof tables, typeof relations>
  }
}
