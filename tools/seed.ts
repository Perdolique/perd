import { createWebSocketClient } from '../server/utils/database'
import { getEnvDatabaseConfig } from '../server/utils/config-env'
import { seedCatalog } from './seed-catalog'

async function main() {
  const databaseConfig = getEnvDatabaseConfig()
  const db = createWebSocketClient(databaseConfig)

  try {
    await seedCatalog(db)
    console.log('Equipment catalog seed completed successfully')
  }
  finally {
    await db.$client.end()
  }
}

await main()
