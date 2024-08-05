import { sql } from 'drizzle-orm'
import { ulid } from 'ulid'

import {
  sqliteTable,
  text,
  integer,
  unique,
  primaryKey,
  index,
  customType
} from 'drizzle-orm/sqlite-core'

/**
 * Custom types
 */

// https://sqlite.org/datatype3.html#collating_sequences
// https://github.com/drizzle-team/drizzle-orm/issues/638
const textNoCase = customType<{ data: string }>({
  dataType() {
    return 'text COLLATE NOCASE'
  }
})

/**
 * Users table
 */

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

/**
 * Equipment table
 */

export const equipment = sqliteTable('equipment', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  name:
    textNoCase('name')
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

/**
 * User's equipment table
 */

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

/**
 * User's checklists table
 */

export const checklists = sqliteTable('checklists', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  userId:
    text('userId')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    text('name')
    .notNull(),

  createdAt:
    integer('createdAt', {
      mode: 'timestamp'
    })
    .notNull()
    .default(sql`(unixepoch())`)
}, (table) => {
  return {
    createdAtIndex: index('createdAtIndex').on(table.createdAt)
  }
})

/**
 * Checklist items table
 */

export const checklistItems = sqliteTable('checklistItems', {
  id:
    text('id')
    .$defaultFn(() => ulid())
    .notNull()
    .primaryKey(),

  checklistId:
    text('checklistId')
    .notNull()
    .references(() => checklists.id, {
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

  isChecked:
    integer('isChecked', {
      mode: 'boolean'
    })
    .notNull()
    .default(false)

}, (table) => ({
  checklistIdEquipmentIdKey: unique().on(table.checklistId, table.equipmentId)
}))
