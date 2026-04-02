import * as v from 'valibot'
import { nonEmptyStringSchema } from './validation/schemas'

interface DatabaseConfig {
  databaseUrl: string;
  isLocalDatabase: boolean;
}

const optionalBooleanSchema = v.pipe(
  v.optional(
    v.union([
      v.string(),
      v.number(),
      v.boolean()
    ])
  ),
  v.transform((value) => value === undefined || value === '' ? false : value),
  v.transform(String),
  v.parseBoolean()
)

function getEnvDatabaseConfig(): DatabaseConfig {
  const databaseUrl = v.parse(nonEmptyStringSchema, process.env.NUXT_DATABASE_URL)
  const isLocalDatabase = v.parse(optionalBooleanSchema, process.env.NUXT_LOCAL_DATABASE)

  return { databaseUrl, isLocalDatabase }
}

export type { DatabaseConfig }

export {
  getEnvDatabaseConfig,
  optionalBooleanSchema
}
