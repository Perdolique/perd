import { createWebSocketClient } from '../server/utils/database'
import { getEnvDatabaseConfig } from '../server/utils/config-env'
import { resetAndSeedCatalog } from './seed-catalog'

async function main() {
  const databaseConfig = getEnvDatabaseConfig()
  const db = createWebSocketClient(databaseConfig)

  try {
    await resetAndSeedCatalog(db)
    console.log('Equipment catalog reset completed successfully')
  }
  finally {
    await db.$client.end()
  }
}

await main()
