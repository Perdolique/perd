import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
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

export const equipment = sqliteTable('equipment', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  name:
    text('name')
    .notNull(),

  weight:
    integer('weight')
    .notNull(),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
})

export const userEquipment = sqliteTable('userEquipment', {
  userId:
    text('userId')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    text('equipmentId')
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
}, (table) => ({
  primaryKey: primaryKey({
    columns: [table.userId, table.equipmentId]
  })
}))
