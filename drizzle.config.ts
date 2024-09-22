import { defineConfig } from 'drizzle-kit'

if (process.env.DATABASE_URL === undefined) {
  throw new Error('DATABASE_URL is not defined')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations'

  // TODO: drizzle-kit doesn't support different drivers at the same time
  // https://orm.drizzle.team/kit-docs/upgrade-21#:~:text=For%20postgresql%20dialect%2C%20Drizzle%20will%3A
  // dbCredentials: {
  //   url: process.env.DATABASE_URL
  // }
})
