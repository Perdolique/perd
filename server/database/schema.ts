import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'

export const users = sqliteTable('users', {
  id:
    text('id')
    .$defaultFn(() => ulid()),

  name: text('name'),

  createdAt:
    integer('created_at', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
})
