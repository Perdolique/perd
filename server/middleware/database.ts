import { passwordRecoveryApiPaths } from '#shared/utils/email-authentication'
import { emailRegistrationApiPaths } from '#shared/utils/email-registration'
import { defineEventHandler, getRequestURL } from 'nuxt/server'
import { createHttpClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig, requireEmailRegistrationEnabled } from '#server/utils/config'

export default defineEventHandler((event): void => {
  // Database access belongs only to application API requests, not page or Nuxt Icon rendering.
  const { pathname } = getRequestURL(event)
  const isApiRequest = pathname === '/api' || pathname.startsWith('/api/')
  const isNuxtIconRequest = pathname.startsWith('/api/_nuxt_icon/')

  if (!isApiRequest || isNuxtIconRequest) {
    return
  }

  const normalizedPath = pathname.replace(/\/$/u, '')

  if (emailRegistrationApiPaths.some(path => path === normalizedPath)) {
    requireEmailRegistrationEnabled()
  }

  if (passwordRecoveryApiPaths.some(path => path === normalizedPath)) {
    return
  }

  if (Reflect.has(event.context, 'dbHttp')) {
    return
  }

  const dbConfig = getRuntimeDatabaseConfig()

  event.context.dbHttp = createHttpClient(dbConfig)
})
