import { defineEventHandler } from 'h3'
import { createHttpClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig } from '#server/utils/config'

declare module 'h3' {
  interface H3EventContext {
    dbHttp: ReturnType<typeof createHttpClient>;
  }
}

export default defineEventHandler((event) => {
  const dbConfig = getRuntimeDatabaseConfig(event)

  event.context.dbHttp = createHttpClient(dbConfig)
})
