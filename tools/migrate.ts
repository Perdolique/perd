import { sql } from 'drizzle-orm'
import { createDrizzleWebsocket, tables } from '~~/server/utils/database'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import drizzleConfig from '~~/drizzle.config'

if (process.env.DATABASE_URL === undefined) {
  throw new Error('DATABASE_URL is not defined')
}

if (drizzleConfig.out === undefined) {
  throw new Error('drizzleConfig.out is not defined')
}

const db = createDrizzleWebsocket()

async function beforeMigration() {
  // Register ULID extension
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS ulid`)
}

async function afterMigration() {
  // Add twitch provider if it doesn't exist
  await db.insert(tables.oauthProviders)
    .values({
      type: 'twitch',
      name: 'Twitch'
    })
    .onConflictDoNothing()
}

/**
 * Migrate the database
 *
 * @todo Move to custom migrations
 * @see {@link https://orm.drizzle.team/docs/kit-custom-migrations}
 */

await beforeMigration()

await migrate(db, {
  migrationsFolder: drizzleConfig.out
})

await afterMigration()

await db.$client.end()
