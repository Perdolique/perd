import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import drizzleConfig from '../drizzle.config'
import { createWebSocketClient } from '../server/utils/database'
import { getEnvDatabaseConfig } from '../server/utils/config-env'

if (drizzleConfig.out === undefined) {
  throw new Error('drizzleConfig.out is not defined')
}

const databaseConfig = getEnvDatabaseConfig()
const dbWebsocket = createWebSocketClient(databaseConfig)

/**
 * Migrate the database
 *
 * @todo Move to custom migrations
 * @see {@link https://orm.drizzle.team/docs/kit-custom-migrations}
 */

await migrate(dbWebsocket, {
  migrationsFolder: drizzleConfig.out
})

await dbWebsocket.$client.end()
