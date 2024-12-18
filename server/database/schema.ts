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
  unique,
  serial,
  text,
  pgEnum,
  check
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
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name: varchar({
    length: limits.maxUserNameLength
  }),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  isAdmin:
    boolean()
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
    serial()
    .primaryKey(),

  type:
    varchar({
      length: limits.maxOAuthProviderTypeLength
    })
    .notNull()
    .unique(),

  name:
    varchar({
      length: limits.maxOAuthProviderNameLength
    })
    .notNull(),

  createdAt:
    timestamp({
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
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  userId:
    ulid()
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  providerId:
    integer()
    .notNull()
    .references(() => oauthProviders.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  accountId:
    varchar()
    .notNull(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => [
  unique().on(table.providerId, table.accountId)
])

/**
 * Equipment types table
 *
 * This table is used to store equipment types
 */

export const equipmentTypes = pgTable('equipmentTypes', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({
      length: limits.maxEquipmentTypeNameLength
    })
    .notNull(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
}, (table) => [
  index().on(table.name)
])


/**
 * Equipment groups table
 *
 * This table is used to store equipment groups
 */

export const equipmentGroups = pgTable('equipmentGroups', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({
      length: limits.maxEquipmentGroupNameLength
    })
    .notNull(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
})

/**
 * Brands table
 *
 * This table is used to store equipment brands
 */

export const brands = pgTable('brands', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({
      length: limits.maxBrandNameLength
    })
    .notNull(),

  websiteUrl: varchar(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => [
  index().on(table.name)
])

/**
 * Equipment table
 *
 * This table is used to store equipment items
 */

export const equipment = pgTable('equipment', {
  id:
    serial()
    .primaryKey(),

  creatorId:
    ulid()
    .references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

  status:
    varchar({
      length: limits.maxEquipmentItemStatusLength
    })
    .notNull(),

  name:
    varchar({
      length: limits.maxEquipmentItemNameLength
    })
    .notNull(),

  description: text(),

  weight:
    integer()
    .notNull()
    .default(0),

  equipmentTypeId:
    integer()
    .references(() => equipmentTypes.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

  equipmentGroupId:
    integer()
    .references(() => equipmentGroups.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

  brandId:
    integer()
    .references(() => brands.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade'
    }),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp({
      withTimezone: true,
      // TODO: https://github.com/drizzle-team/drizzle-orm/issues/2388
      mode: 'string'
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
}, (table) => [
  index().on(table.equipmentTypeId),
  index().on(table.equipmentGroupId),
  index().on(table.brandId),

  check(
    'equipment_description_check',
    sql.raw(`char_length(description) <= ${limits.maxEquipmentDescriptionLength}`)
  )
])

/**
 * Equipment attributes data types
 *
 * Types of data that can be stored in the attribute
 */
export const equipmentAttributeDataType = pgEnum('equipmentAttributeDataType', [
  'boolean',
  'string',
  'integer',
  'decimal'
])

/**
 * Equipment attributes table
 *
 * This table is used to store equipment attributes
 */

export const equipmentAttributes = pgTable('equipmentAttributes', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({
      length: limits.maxEquipmentAttributeNameLength
    })
    .notNull(),

  dataType:
    equipmentAttributeDataType()
    .notNull()
})

/**
 * Equipment type attributes table
 *
 * This table is used to store the attributes of the equipment type
 */

export const equipmentTypeAttributes = pgTable('equipmentTypeAttributes', {
  equipmentTypeId:
    integer()
    .references(() => equipmentTypes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentAttributeId:
    integer()
    .references(() => equipmentAttributes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    })
}, (table) => [
  primaryKey({
    columns: [table.equipmentTypeId, table.equipmentAttributeId]
  }),

  index().on(table.equipmentTypeId),
  index().on(table.equipmentAttributeId)
])

/**
 * Equipment attribute values table
 *
 * This table is used to store the values of the equipment attributes
 */

export const equipmentAttributeValues = pgTable('equipmentAttributeValues', {
  id:
    serial()
    .primaryKey(),

  equipmentId:
    integer()
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentAttributeId:
    integer()
    .notNull()
    .references(() => equipmentAttributes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  value:
    varchar()
    .notNull()
}, (table) => [
  unique().on(table.equipmentId, table.equipmentAttributeId),
  index().on(table.equipmentId),
  index().on(table.equipmentAttributeId)
])

/**
 * User's equipment table
 *
 * This table is used to store the user's equipment
 */

export const userEquipment = pgTable('userEquipment', {
  userId:
    ulid()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    integer()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => [
  primaryKey({
    columns: [table.userId, table.equipmentId]
  })
])

/**
 * User's checklists table
 *
 * This table is used to store the user's checklists
 */

export const checklists = pgTable('checklists', {
  id:
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  userId:
    ulid()
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    varchar({
      length: limits.maxChecklistNameLength
    })
    .notNull(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => [
  index('createdAtIndex').on(table.createdAt)
])

/**
 * Checklist items table
 *
 * This table is used to store the checklist items
 */

export const checklistItems = pgTable('checklistItems', {
  id:
    serial()
    .primaryKey(),

  checklistId:
    ulid()
    .notNull()
    .references(() => checklists.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    integer()
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    })
}, (table) => [
  unique().on(table.checklistId, table.equipmentId)
])

/**
 * Relations
 */

export const usersRelations = relations(users, ({ many }) => ({
  equipment: many(equipment),
  userEquipment: many(userEquipment),
  checklists: many(checklists),
  oauthAccounts: many(oauthAccounts)
}))

export const oauthProvidersRelations = relations(oauthProviders, ({ many }) => ({
  oauthAccounts: many(oauthAccounts)
}))

export const equipmentTypesRelations = relations(equipmentTypes, ({ many }) => ({
  equipment: many(equipment),
  equipmentTypeAttributes: many(equipmentTypeAttributes)
}))

export const equipmentGroupsRelations = relations(equipmentGroups, ({ many }) => ({
  equipment: many(equipment)
}))

export const brandsRelations = relations(brands, ({ many }) => ({
  equipment: many(equipment)
}))

export const equipmentRelations = relations(equipment, ({ many, one }) => ({
  userEquipment: many(userEquipment),
  checklistItems: many(checklistItems),
  equipmentAttributeValues: many(equipmentAttributeValues),

  equipmentType: one(equipmentTypes, {
    fields: [equipment.equipmentTypeId],
    references: [equipmentTypes.id]
  }),

  equipmentGroup: one(equipmentGroups, {
    fields: [equipment.equipmentGroupId],
    references: [equipmentGroups.id]
  }),

  creatorId: one(users, {
    fields: [equipment.creatorId],
    references: [users.id]
  }),

  brand: one(brands, {
    fields: [equipment.brandId],
    references: [brands.id]
  })
}))

export const equipmentAttributesRelations = relations(equipmentAttributes, ({ many }) => ({
  equipmentTypeAttributes: many(equipmentTypeAttributes),
  equipmentAttributeValues: many(equipmentAttributeValues)
}))

export const equipmentTypeAttributesRelations = relations(equipmentTypeAttributes, ({ one }) => ({
  equipmentType: one(equipmentTypes, {
    fields: [equipmentTypeAttributes.equipmentTypeId],
    references: [equipmentTypes.id]
  }),

  equipmentAttribute: one(equipmentAttributes, {
    fields: [equipmentTypeAttributes.equipmentAttributeId],
    references: [equipmentAttributes.id]
  })
}))

export const equipmentAttributeValuesRelations = relations(equipmentAttributeValues, ({ one }) => ({
  equipment: one(equipment, {
    fields: [equipmentAttributeValues.equipmentId],
    references: [equipment.id]
  }),

  equipmentAttribute: one(equipmentAttributes, {
    fields: [equipmentAttributeValues.equipmentAttributeId],
    references: [equipmentAttributes.id]
  })
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
