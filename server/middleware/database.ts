import { passwordRecoveryApiPaths } from '#shared/utils/email-authentication'
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

  const normalizedPath = pathname.replace(/\/$/u, '')

  if (emailRegistrationApiPaths.some(path => path === normalizedPath)) {
    requireEmailRegistrationEnabled(event)
  }

  if (passwordRecoveryApiPaths.some(path => path === normalizedPath)) {
    return
  }

  if (Reflect.has(event.context, 'dbHttp')) {
    return
  }

  const dbConfig = getRuntimeDatabaseConfig(event)

  event.context.dbHttp = createHttpClient(dbConfig)
})
