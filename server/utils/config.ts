import * as v from 'valibot'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { nonEmptyStringSchema } from '#server/utils/validation/schemas'
import { optionalBooleanSchema, type DatabaseConfig } from './config-env'

const sessionSecretSchema = v.pipe(
  v.string('Session secret must be a string'),
  v.minLength(32, 'Session secret must be at least 32 characters long')
)

function getRuntimeDatabaseConfig(event: H3Event): DatabaseConfig {
  const config = useRuntimeConfig(event)
  const databaseUrl = v.parse(nonEmptyStringSchema, config.databaseUrl)
  const localFlag = v.parse(optionalBooleanSchema, config.localDatabase)
  const isLocalDatabase = import.meta.dev === true || localFlag

  return { databaseUrl, isLocalDatabase }
}

function getRuntimeSessionSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const secret = v.parse(sessionSecretSchema, config.sessionSecret)

  return secret
}

export {
  getRuntimeDatabaseConfig,
  getRuntimeSessionSecret
}
