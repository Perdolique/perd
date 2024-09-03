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
 *
 * These are custom types that are not supported by the default drizzle-orm
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
 *
 * This table is used to store user information
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
 * OAuth providers table
 *
 * This table is used to store OAuth providers
 * For example, Twitch, Google, Facebook, etc.
 */

export const oauthProviders = pgTable('oauthProviders', {
  id:
    ulid('id')
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  type:
    varchar('type', {
      length: 32
    })
    .notNull()
    .unique(),

  name:
    varchar('name', {
      length: 255
    })
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * OAuth accounts table
 *
 * This table is used to store OAuth accounts linked to the user
 * For example, if the user logs in with Twitch, we store the Twitch account ID here
 */

export const oauthAccounts = pgTable('oauthAccounts', {
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

  providerId:
    ulid('providerId')
    .notNull()
    .references(() => oauthProviders.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  accountId:
    varchar('accountId')
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => ({
  uniqueProviderIdAccountId: unique().on(table.providerId, table.accountId)
}))

/**
 * Equipment table
 *
 * This table is used to store equipment items
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
 *
 * This table is used to store the user's equipment
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
 *
 * This table is used to store the user's checklists
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
 *
 * This table is used to store the checklist items
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
  checklists: many(checklists),
  oauthAccounts: many(oauthAccounts)
}))

export const oauthProvidersRelations = relations(oauthProviders, ({ many }) => ({
  oauthAccounts: many(oauthAccounts)
}))

export const equipmentRelations = relations(equipment, ({ many }) => ({
  userEquipment: many(userEquipment),
  checklistItems: many(checklistItems)
}))

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id]
  }),

  provider: one(oauthProviders, {
    fields: [oauthAccounts.providerId],
    references: [oauthProviders.id]
  })
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
