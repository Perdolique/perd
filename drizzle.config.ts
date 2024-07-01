import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',

  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/b503f4e7ef19c5cd737f108e07d3ca235692e3c14ad1f9710626153fb46a201d.sqlite'
  }
})
