import * as v from 'valibot'
import { createError, type H3Event } from 'h3'
import { isEmailRegistrationEnabled } from '#shared/utils/email-registration'
import { useRuntimeConfig } from 'nitropack/runtime'
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

function getRuntimeDatabaseConfig(event: H3Event): DatabaseConfig {
  const config = useRuntimeConfig(event)
  const databaseUrl = v.parse(nonEmptyStringSchema, config.databaseUrl)
  const localFlag = v.parse(optionalBooleanSchema, config.localDatabase)
  const isLocalDatabase = import.meta.dev === true || localFlag

  return {
    databaseUrl,
    isLocalDatabase
  }
}

function getRuntimeSessionSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const secret = v.parse(sessionSecretSchema, config.sessionSecret)

  return secret
}

function getRuntimeTurnstileConfig(event: H3Event): TurnstileConfig {
  const config = useRuntimeConfig(event)

  return validateTurnstileConfig(config.turnstile)
}

function createWebSocketClientFromEvent(event: H3Event) {
  const config = getRuntimeDatabaseConfig(event)

  return createWebSocketClient(config)
}

function requireEmailRegistrationEnabled(event: H3Event): void {
  const config = useRuntimeConfig(event)

  if (!isEmailRegistrationEnabled(config.public.emailRegistrationEnabled)) {
    throw createError({ status: 404 })
  }
}

function getEmailRegistrationConfig(event: H3Event): EmailRegistrationConfig {
  requireEmailRegistrationEnabled(event)

  const config = useRuntimeConfig(event)

  return validateEmailRegistrationConfig(config.emailRegistration)
}

function getEmailAuthenticationOrigin(event: H3Event): string {
  const config = useRuntimeConfig(event)

  return validateEmailAuthenticationOrigin(config.emailRegistration)
}

function getEmailAuthenticationConfig(event: H3Event): EmailAuthenticationConfig {
  const config = useRuntimeConfig(event)

  return validateEmailAuthenticationConfig(config.emailRegistration)
}

export {
  createWebSocketClientFromEvent,
  getEmailAuthenticationConfig,
  getEmailAuthenticationOrigin,
  getEmailRegistrationConfig,
  getRuntimeDatabaseConfig,
  getRuntimeSessionSecret,
  getRuntimeTurnstileConfig,
  requireEmailRegistrationEnabled
}
