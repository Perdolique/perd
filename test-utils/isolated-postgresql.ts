import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { env } from 'node:process'
import { URL } from 'node:url'
import { sql } from 'drizzle-orm'
import { createWebSocketClient } from '#server/utils/database'

type TestDatabase = ReturnType<typeof createWebSocketClient>

interface IsolatedPostgreSQLContext {
  database: TestDatabase;
  rootDatabase: TestDatabase;
  dispose: () => Promise<void>;
}

interface DatabaseResources {
  database: TestDatabase | null;
  rootDatabase: TestDatabase | null;
  schemaName: string;
}

const localDatabaseHosts = new Set([
  'localhost',
  '127.0.0.1',
  'db.localtest.me'
])

const schemaPrefixPattern = /^[a-z][a-z0-9_]*$/u
const generatedSchemaPattern = /^[a-z][a-z0-9_]*_[\da-f]{32}$/u

function getLocalDatabaseUrl(): URL {
  if (!['true', '1'].includes(env.NUXT_LOCAL_DATABASE ?? '')) {
    throw new Error('Integration tests require NUXT_LOCAL_DATABASE=true')
  }

  const databaseUrl = new URL(env.NUXT_DATABASE_URL ?? '')

  if (!localDatabaseHosts.has(databaseUrl.hostname)) {
    throw new Error('Integration tests require a local PostgreSQL host')
  }

  return databaseUrl
}

async function applyMigrations(database: TestDatabase): Promise<void> {
  const migrations = new URL('../server/database/migrations/', import.meta.url)
  const folders = await readdir(migrations)

  // oxlint-disable-next-line unicorn/no-array-sort -- The project TypeScript target does not expose ES2023 Array#toSorted.
  const migrationNames = folders.filter(name => /^\d{14}_/u.test(name)).sort()

  for (const name of migrationNames) {
    // oxlint-disable-next-line no-await-in-loop -- Migrations depend on the preceding schema version.
    const migration = await readFile(new URL(`${name}/migration.sql`, migrations), 'utf8')

    // oxlint-disable-next-line no-await-in-loop -- Migrations must be applied in timestamp order.
    await database.execute(sql.raw(migration))
  }
}

async function releaseDatabaseResources(resources: DatabaseResources): Promise<void> {
  const errors: unknown[] = []

  if (resources.database !== null) {
    try {
      await resources.database.$client.end()
    } catch (error) {
      errors.push(error)
    }
  }

  if (resources.rootDatabase !== null && generatedSchemaPattern.test(resources.schemaName)) {
    try {
      await resources.rootDatabase.execute(sql.raw(`DROP SCHEMA IF EXISTS "${resources.schemaName}" CASCADE`))
    } catch (error) {
      errors.push(error)
    }
  }

  if (resources.rootDatabase !== null) {
    try {
      await resources.rootDatabase.$client.end()
    } catch (error) {
      errors.push(error)
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, 'Failed to release isolated PostgreSQL resources')
  }
}

/** Creates a migrated local PostgreSQL schema and owns its complete cleanup lifecycle. */
async function createIsolatedPostgreSQL(schemaPrefix: string): Promise<IsolatedPostgreSQLContext> {
  if (!schemaPrefixPattern.test(schemaPrefix)) {
    throw new Error('Invalid isolated PostgreSQL schema prefix')
  }

  const databaseUrl = getLocalDatabaseUrl()
  const schemaName = `${schemaPrefix}_${randomUUID().replaceAll('-', '')}`

  const resources: DatabaseResources = {
    database: null,
    rootDatabase: null,
    schemaName
  }

  try {
    resources.rootDatabase = createWebSocketClient({
      databaseUrl: databaseUrl.toString(),
      isLocalDatabase: true
    })

    await resources.rootDatabase.execute(sql.raw(`CREATE SCHEMA "${schemaName}"`))
    databaseUrl.searchParams.set('options', `-c search_path=${schemaName}`)

    resources.database = createWebSocketClient({
      databaseUrl: databaseUrl.toString(),
      isLocalDatabase: true
    })

    const schema = await resources.database.execute<{ name: string; }>(sql`SELECT current_schema() AS name`)

    if (schema.rows[0]?.name !== schemaName) {
      throw new Error('Isolated schema was not selected; refusing to run migrations')
    }

    await applyMigrations(resources.database)

    let isDisposed = false

    return {
      database: resources.database,
      rootDatabase: resources.rootDatabase,

      async dispose() {
        if (isDisposed) {
          return
        }

        isDisposed = true

        await releaseDatabaseResources(resources)
      }
    }
  } catch (error) {
    try {
      await releaseDatabaseResources(resources)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Failed to create isolated PostgreSQL resources',
        { cause: cleanupError }
      )
    }

    throw error
  }
}

export { createIsolatedPostgreSQL }
