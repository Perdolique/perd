import { emailRegistrationApiPaths } from '#shared/utils/email-registration'
import { defineEventHandler, getRequestURL } from 'h3'
import { createHttpClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig, requireEmailRegistrationEnabled } from '#server/utils/config'

declare module 'h3' {
  interface H3EventContext {
    dbHttp: ReturnType<typeof createHttpClient>;
  }
}

export default defineEventHandler((event) => {
  // Database access belongs only to unhandled application API requests, not page or Nuxt Icon rendering.
  if (event.handled) {
    return
  }

  const { pathname } = getRequestURL(event)
  const isApiRequest = pathname === '/api' || pathname.startsWith('/api/')
  const isNuxtIconRequest = pathname.startsWith('/api/_nuxt_icon/')

  if (!isApiRequest || isNuxtIconRequest) {
    return
  }

  if (emailRegistrationApiPaths.some(path => path === pathname.replace(/\/$/u, ''))) {
    requireEmailRegistrationEnabled(event)
  }

  const dbConfig = getRuntimeDatabaseConfig(event)

  event.context.dbHttp = createHttpClient(dbConfig)
})
