import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleNeon, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from '../database/schema'

export const tables = schema

export async function createDrizzle() {
  if (process.env.DATABASE_URL === undefined) {
    throw new Error('DATABASE_URL is not defined')
  }

  let drizzleDb :  NeonHttpDatabase<typeof tables> | PostgresJsDatabase<typeof tables>

  if (import.meta.dev) {
    const imports = await Promise.all([
      import('postgres'),
      import('drizzle-orm/postgres-js')
    ])

    const postgres = imports[0].default
    const { drizzle: drizzlePostgres } = imports[1]
    const db = postgres(process.env.DATABASE_URL)

    drizzleDb = drizzlePostgres(db, {
      schema,
      logger: true
    })
  } else {
    const db = neon(process.env.DATABASE_URL)

    drizzleDb = drizzleNeon(db, {
      schema,
      logger: true
    })
  }


  return drizzleDb
}
