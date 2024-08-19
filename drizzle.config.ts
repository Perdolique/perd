import { defineConfig } from 'drizzle-kit'

if (process.env.DATABASE_URL === undefined) {
  throw new Error('DATABASE_URL is not defined')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',

  dbCredentials: {
    url: process.env.DATABASE_URL
  }
})
