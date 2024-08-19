import { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export default defineEventHandler(async ({ context }) => {
  if (context.db === undefined) {
    const drizzleDb = await createDrizzle()

    context.db = drizzleDb
  }
})

declare module 'h3' {
  interface H3EventContext {
    db: NeonHttpDatabase<typeof tables> | PostgresJsDatabase<typeof tables>
  }
}
