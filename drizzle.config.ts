import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',

  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8c3e65ccafb38e310d0604136403df14da46b2ca276f21f7d976e97052d9701e.sqlite'
  }
})
