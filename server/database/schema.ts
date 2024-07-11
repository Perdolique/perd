import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, } from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'

export const users = sqliteTable('users', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  name: text('name'),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`),

  isAdmin:
    integer('isAdmin', {
      mode: 'boolean'
    })
    .notNull()
    .default(false)
})

export const gears = sqliteTable('gears', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  name: text('name'),
  weight: integer('weight'),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
})
