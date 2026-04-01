// oxlint-disable import/no-relative-parent-imports
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import { drizzle as drizzleWebsocket } from 'drizzle-orm/neon-serverless'
import { neon, neonConfig, Pool } from '@neondatabase/serverless'
import ws from 'ws'
import * as schema from '../database/schema'
import { relations } from '../database/relations'
import type { DatabaseConfig } from './config-env'

/**
 * HTTP Client:
 * - Best for serverless functions and Lambda environments
 * - Ideal for stateless operations and quick queries
 * - Lower overhead for single queries
 * - Better for applications with sporadic database access
 */
function createHttpClient(config: DatabaseConfig) {
  if (config.isLocalDatabase) {
    // Check docker-compose.yml for the details
    neonConfig.fetchEndpoint = 'http://db.localtest.me:4444/sql'
  }

  const sql = neon(config.databaseUrl)

  const dbHttp = drizzleHttp({
    client: sql,
    schema,
    relations,
    logger: true
  })

  return dbHttp
}

/**
 * WebSocket Client:
 * - Best for long-running applications (like servers)
 * - Maintains a persistent connection
 * - More efficient for multiple sequential queries
 * - Better for high-frequency database operations
 */
function createWebSocketClient(config: DatabaseConfig) {
  if (config.isLocalDatabase) {
    neonConfig.fetchEndpoint = 'http://db.localtest.me:4444/sql'
    neonConfig.useSecureWebSocket = false
    neonConfig.wsProxy = 'db.localtest.me:4444/v2'
  }

  neonConfig.webSocketConstructor = ws

  const pool = new Pool({ connectionString: config.databaseUrl })

  const dbWebsocket = drizzleWebsocket({
    client: pool,
    schema,
    relations,
    logger: true
  })

  return dbWebsocket
}

export {
  createHttpClient,
  createWebSocketClient
}
