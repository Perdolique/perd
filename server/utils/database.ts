import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless'
import { neon, neonConfig, Pool } from '@neondatabase/serverless'
import ws from 'ws'
import * as schema from '../database/schema'


export const tables = schema

export function createDrizzle() {
  if (process.env.DATABASE_URL === undefined) {
    throw new Error('DATABASE_URL is not defined')
  }

  if (import.meta.dev === true || process.env.LOCAL_DATABASE) {
    // Check docker-compose.yml for the details
    neonConfig.fetchEndpoint = 'http://db.localtest.me:4444/sql'
  }

  const db = neon(process.env.DATABASE_URL)

  const drizzleDb = drizzleNeon({
    client: db,
    schema,
    logger: true
  })

  return drizzleDb
}

/**
 * Create a Drizzle database instance with WebSocket support.
 * It requires for transactional operations.
 *
 * @see {@link https://orm.drizzle.team/docs/get-started-postgresql#neon-postgres}
 * @see {@link https://github.com/neondatabase/serverless?tab=readme-ov-file#sessions-transactions-and-node-postgres-compatibility}
 */
export function createDrizzleWebsocket() {
  neonConfig.webSocketConstructor = ws

  if (import.meta.dev === true || process.env.LOCAL_DATABASE) {
    neonConfig.wsProxy = (host) => `${host}:5433/v1`
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  const drizzleDb = drizzleServerless({
    client: pool,
    schema,
    logger: true
  })

  return drizzleDb
}
