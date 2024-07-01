import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
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
    .default(sql`(unixepoch())`)
})

export const userSessions = sqliteTable('user_sessions', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  session:
    text('session')
    .notNull(),

  userId:
    text('userId')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
})

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  })
}));
