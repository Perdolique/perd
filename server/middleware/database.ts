import { DrizzleD1Database } from 'drizzle-orm/d1'

export default defineEventHandler(async ({ context }) => {
  if (context.db) {
    return context.db
  }

  const drizzleDb = createDrizzle(context.cloudflare.env.DB)

  context.db = drizzleDb
})

declare module 'h3' {
  interface H3EventContext {
    db: DrizzleD1Database
  }
}
