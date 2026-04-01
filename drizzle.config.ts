import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.NUXT_DATABASE_URL

if (databaseUrl === undefined) {
  throw new Error('NUXT_DATABASE_URL environment variable is not defined')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',

  dbCredentials: {
    url: databaseUrl,
  }
})
