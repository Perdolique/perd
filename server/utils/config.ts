import * as v from 'valibot'
import { createError, useRuntimeConfig } from 'nuxt/server'
import { isEmailRegistrationEnabled } from '#shared/utils/email-registration'
import { nonEmptyStringSchema } from '#server/utils/validation/schemas'
import { createWebSocketClient } from './database'
import { optionalBooleanSchema, type DatabaseConfig } from './config-env'

import {
  validateEmailAuthenticationConfig,
  validateEmailAuthenticationOrigin,
  validateEmailRegistrationConfig,
  type EmailAuthenticationConfig,
  type EmailRegistrationConfig
} from './auth/email-registration-config'

import { validateTurnstileConfig, type TurnstileConfig } from './turnstile-config'

const sessionSecretSchema = v.pipe(
  v.string('Session secret must be a string'),
  v.minLength(32, 'Session secret must be at least 32 characters long')
)

function getRuntimeDatabaseConfig(): DatabaseConfig {
  const config = useRuntimeConfig()
  const databaseUrl = v.parse(nonEmptyStringSchema, config.databaseUrl)
  const localFlag = v.parse(optionalBooleanSchema, config.localDatabase)
  const isLocalDatabase = import.meta.dev === true || localFlag

  return {
    databaseUrl,
    isLocalDatabase
  }
}

function getRuntimeSessionSecret(): string {
  const config = useRuntimeConfig()
  const secret = v.parse(sessionSecretSchema, config.sessionSecret)

  return secret
}

function getRuntimeTurnstileConfig(): TurnstileConfig {
  const config = useRuntimeConfig()

  return validateTurnstileConfig(config.turnstile)
}

function createRuntimeWebSocketClient() {
  const config = getRuntimeDatabaseConfig()

  return createWebSocketClient(config)
}

function requireEmailRegistrationEnabled(): void {
  const config = useRuntimeConfig()

  if (!isEmailRegistrationEnabled(config.public.emailRegistrationEnabled)) {
    throw createError({ status: 404 })
  }
}

function getEmailRegistrationConfig(): EmailRegistrationConfig {
  requireEmailRegistrationEnabled()

  const config = useRuntimeConfig()

  return validateEmailRegistrationConfig(config.emailRegistration)
}

function getEmailAuthenticationOrigin(): string {
  const config = useRuntimeConfig()

  return validateEmailAuthenticationOrigin(config.emailRegistration)
}

function getEmailAuthenticationConfig(): EmailAuthenticationConfig {
  const config = useRuntimeConfig()

  return validateEmailAuthenticationConfig(config.emailRegistration)
}

export {
  createRuntimeWebSocketClient,
  getEmailAuthenticationConfig,
  getEmailAuthenticationOrigin,
  getEmailRegistrationConfig,
  getRuntimeDatabaseConfig,
  getRuntimeSessionSecret,
  getRuntimeTurnstileConfig,
  requireEmailRegistrationEnabled
}
