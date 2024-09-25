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
  pgEnum
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
    serial('id')
    .primaryKey(),

  type:
    varchar('type', {
      length: limits.maxOAuthProviderTypeLength
    })
    .notNull()
    .unique(),

  name:
    varchar('name', {
      length: limits.maxOAuthProviderNameLength
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
    integer('providerId')
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
 * Equipment types table
 *
 * This table is used to store equipment types
 */

export const equipmentTypes = pgTable('equipmentTypes', {
  id:
    serial('id')
    .primaryKey(),

  name:
    varchar('name', {
      length: limits.maxEquipmentTypeNameLength
    })
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp('updatedAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
}, (table) => ({
  nameIndex: index().on(table.name)
}))


/**
 * Equipment groups table
 *
 * This table is used to store equipment groups
 */

export const equipmentGroups = pgTable('equipmentGroups', {
  id:
    serial('id')
    .primaryKey(),

  name:
    varchar('name', {
      length: limits.maxEquipmentGroupNameLength
    })
    .notNull(),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp('updatedAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
})

/**
 * Equipment table
 *
 * This table is used to store equipment items
 */

export const equipment = pgTable('equipment', {
  id:
    serial('id')
    .primaryKey(),

  name:
    varchar('name', {
      length: limits.maxEquipmentItemNameLength
    })
    .notNull(),

  description: text('description'),

  weight:
    integer('weight')
    .notNull()
    .default(0),

  equipmentTypeId:
    integer('equipmentTypeId')
    .references(() => equipmentTypes.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

  equipmentGroupId:
    integer('equipmentGroupId')
    .references(() => equipmentGroups.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

  createdAt:
    timestamp('createdAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow(),

  updatedAt:
    timestamp('updatedAt', {
      withTimezone: true
    })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`)
}, (table) => {
  return {
    typeIdIndex: index().on(table.equipmentTypeId),
    groupIdIndex: index().on(table.equipmentGroupId)
  }
})

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
    serial('id')
    .primaryKey(),

  name:
    varchar('name', {
      length: limits.maxEquipmentAttributeNameLength
    })
    .notNull(),

  dataType:
    equipmentAttributeDataType('dataType')
    .notNull()
})

/**
 * Equipment type attributes table
 *
 * This table is used to store the attributes of the equipment type
 */

export const equipmentTypeAttributes = pgTable('equipmentTypeAttributes', {
  equipmentTypeId:
    integer('equipmentTypeId')
    .references(() => equipmentTypes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentAttributeId:
    integer('equipmentAttributeId')
    .references(() => equipmentAttributes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    })
}, (table) => ({
  primaryKey: primaryKey({
    columns: [table.equipmentTypeId, table.equipmentAttributeId]
  }),

  equipmentTypeIdIndex: index().on(table.equipmentTypeId),
  attributeIdIndex: index().on(table.equipmentAttributeId)
}))

/**
 * Equipment attribute values table
 *
 * This table is used to store the values of the equipment attributes
 */

export const equipmentAttributeValues = pgTable('equipmentAttributeValues', {
  id:
    serial('id')
    .primaryKey(),

  equipmentId:
    integer('equipmentId')
    .notNull()
    .references(() => equipment.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentAttributeId:
    integer('equipmentAttributeId')
    .notNull()
    .references(() => equipmentAttributes.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  value:
    varchar('value')
    .notNull()
}, (table) => ({
  uniqueEquipmentIdAttributeId: unique().on(table.equipmentId, table.equipmentAttributeId),
  equipmentIdIndex: index().on(table.equipmentId),
  attributeIdIndex: index().on(table.equipmentAttributeId)
}))

/**
 * User's equipment table
 *
 * This table is used to store the user's equipment
 */

export const userEquipment = pgTable('userEquipment', {
  userId:
    ulid('userId')
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    integer('equipmentId')
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
    serial('id')
    .primaryKey(),

  checklistId:
    ulid('checklistId')
    .notNull()
    .references(() => checklists.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  equipmentId:
    integer('equipmentId')
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

export const equipmentTypesRelations = relations(equipmentTypes, ({ many }) => ({
  equipment: many(equipment),
  equipmentTypeAttributes: many(equipmentTypeAttributes)
}))

export const equipmentGroupsRelations = relations(equipmentGroups, ({ many }) => ({
  equipment: many(equipment)
}))

export const equipmentRelations = relations(equipment, ({ many, one }) => ({
  userEquipment: many(userEquipment),
  checklistItems: many(checklistItems),

  equipmentType: one(equipmentTypes, {
    fields: [equipment.equipmentTypeId],
    references: [equipmentTypes.id]
  }),

  equipmentGroup: one(equipmentGroups, {
    fields: [equipment.equipmentGroupId],
    references: [equipmentGroups.id]
  }),

  equipmentAttributeValues: many(equipmentAttributeValues)
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
