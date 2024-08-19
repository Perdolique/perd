import { relations, sql } from 'drizzle-orm'
import { limits } from '../../constants'

import {
  pgTable,
  integer,
  customType,
  timestamp,
  boolean,
  varchar,
  primaryKey,
  index,
  unique
} from 'drizzle-orm/pg-core'

/**
 * Custom types
 */

// Neon ulid type
// https://github.com/pksunkara/pgx_ulid
const ulid = customType<{ data: string }>({
  dataType() {
    return 'ulid'
  }
})

/**
 * Users table
 */

export const users = pgTable('users', {
  id:
    ulid('id')
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name: varchar('name', {
    length: limits.maxUserNameLength
  }),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  isAdmin:
    boolean('isAdmin')
    .notNull()
    .default(false)
})

/**
 * Equipment table
 */

export const equipment = pgTable('equipment', {
  id:
    ulid('id')
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name:
    varchar('name', {
      length: limits.maxEquipmentItemNameLength
    })
    .notNull(),

  weight:
    integer('weight')
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * User's equipment table
 */

export const userEquipment = pgTable('userEquipment', {
  userId:
    ulid('userId')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    ulid('equipmentId')
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => ({
  primaryKey: primaryKey({
    columns: [table.userId, table.equipmentId]
  })
}))

/**
 * User's checklists table
 */

export const checklists = pgTable('checklists', {
  id:
    ulid('id')
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  userId:
    ulid('userId')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    varchar('name', {
      length: limits.maxChecklistNameLength
    })
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => {
  return {
    createdAtIndex: index('createdAtIndex').on(table.createdAt)
  }
})

/**
 * Checklist items table
 */

export const checklistItems = pgTable('checklistItems', {
  id:
    ulid('id')
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  checklistId:
    ulid('checklistId')
    .notNull()
    .references(() => checklists.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    ulid('equipmentId')
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    })
}, (table) => ({
  checklistIdEquipmentIdKey: unique().on(table.checklistId, table.equipmentId)
}))

/**
 * Relations
 */

export const usersRelations = relations(users, ({ many }) => ({
  userEquipment: many(userEquipment),
  checklists: many(checklists)
}))

export const equipmentRelations = relations(equipment, ({ many }) => ({
  userEquipment: many(userEquipment),
  checklistItems: many(checklistItems)
}))

export const userEquipmentRelations = relations(userEquipment, ({ one }) => ({
  user: one(users, {
    fields: [userEquipment.userId],
    references: [users.id]
  }),

  equipment: one(equipment, {
    fields: [userEquipment.equipmentId],
    references: [equipment.id]
  })
}))

export const checklistsRelations = relations(checklists, ({ many, one }) => ({
  checklistItems: many(checklistItems),

  user: one(users, {
    fields: [checklists.userId],
    references: [users.id]
  })
}))

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklists: one(checklists, {
    fields: [checklistItems.checklistId],
    references: [checklists.id]
  }),

  equipment: one(equipment, {
    fields: [checklistItems.equipmentId],
    references: [equipment.id]
  })
}))
