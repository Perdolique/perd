// oxlint-disable max-lines
// oxlint-disable import/no-relative-parent-imports
import { sql } from 'drizzle-orm'
import { integer, serial, timestamp, boolean, varchar, unique, uuid, numeric, jsonb, pgTable } from 'drizzle-orm/pg-core'
// FIXME: drizzle-kit can't handle #shared/constants, so we have to import it with a relative path
import { limits } from '../../shared/constants'

// ─── Auth ───────────────────────────────────────────────────────────

/**
 * Registered users.
 *
 * Created automatically on first OAuth login.
 */
const users = pgTable('users', {
  id:
    uuid()
    .notNull()
    .default(sql`uuidv7()`)
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
 * Supported OAuth providers (e.g. Twitch).
 *
 * Seeded on deployment, not user-managed.
 */
const oauthProviders = pgTable('oauth_providers', {
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
 * Links between users and their OAuth provider accounts.
 *
 * A user can have multiple OAuth accounts across different providers.
 */
const oauthAccounts = pgTable('oauth_accounts', {
  id:
    uuid()
    .notNull()
    .default(sql`uuidv7()`)
    .primaryKey(),

  userId:
    uuid()
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

// ─── Equipment catalog ──────────────────────────────────────────────

/**
 * Top-level functional groupings (e.g. Sleep, Shelter, Cooking).
 *
 * Used for navigation and organizing categories.
 */
const equipmentGroups = pgTable('equipment_groups', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({ length: 64 })
    .notNull(),

  slug:
    varchar({ length: 128 })
    .notNull()
    .unique(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * Specific equipment types (e.g. Sleeping Bags, Sleeping Pads).
 *
 * Each category defines its own set of properties via `category_properties`.
 */
const equipmentCategories = pgTable('equipment_categories', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({ length: 64 })
    .notNull(),

  slug:
    varchar({ length: 128 })
    .notNull()
    .unique(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * Equipment manufacturers (e.g. Therm-a-Rest, Nemo).
 *
 * Each item belongs to exactly one brand.
 */
const brands = pgTable('brands', {
  id:
    serial()
    .primaryKey(),

  name:
    varchar({ length: 128 })
    .notNull()
    .unique(),

  slug:
    varchar({ length: 128 })
    .notNull()
    .unique(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * Individual equipment entries in the global catalog.
 *
 * Each size/variant is a separate item. Status controls visibility (approved/pending/rejected).
 */
const equipmentItems = pgTable('equipment_items', {
  id:
    uuid()
    .notNull()
    .default(sql`uuidv7()`)
    .primaryKey(),

  categoryId:
    integer()
    .notNull()
    .references(() => equipmentCategories.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  brandId:
    integer()
    .notNull()
    .references(() => brands.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    varchar({ length: 256 })
    .notNull(),

  status:
    varchar({ length: 16 })
    .notNull()
    .default('approved'),

  createdBy:
    uuid()
    .references(() => users.id, {
      onDelete: 'set null',
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
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

/**
 * Property definitions per category (EAV schema layer).
 *
 * Defines what properties a category has (e.g. R-Value for sleeping bags). Supports number, text, boolean, and enum data types.
 */
const categoryProperties = pgTable('category_properties', {
  id:
    serial()
    .primaryKey(),

  categoryId:
    integer()
    .notNull()
    .references(() => equipmentCategories.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    varchar({ length: 64 })
    .notNull(),

  slug:
    varchar({ length: 128 })
    .notNull(),

  dataType:
    varchar({ length: 16 })
    .notNull(),

  unit:
    varchar({ length: 16 }),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
}, (table) => [
  unique().on(table.categoryId, table.slug)
])

/**
 * Allowed values for enum-type properties.
 *
 * E.g. Fill Type property might have options: "Down", "Synthetic".
 */
const propertyEnumOptions = pgTable('property_enum_options', {
  id:
    serial()
    .primaryKey(),

  propertyId:
    integer()
    .notNull()
    .references(() => categoryProperties.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  name:
    varchar({ length: 64 })
    .notNull(),

  slug:
    varchar({ length: 128 })
    .notNull()
}, (table) => [
  unique().on(table.propertyId, table.slug)
])

/**
 * Actual property values for items (EAV value layer).
 *
 * Stores one value per item–property pair. Only one of valueText/valueNumber/valueBoolean is set depending on the property's dataType.
 */
const itemPropertyValues = pgTable('item_property_values', {
  id:
    serial()
    .primaryKey(),

  itemId:
    uuid()
    .notNull()
    .references(() => equipmentItems.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  propertyId:
    integer()
    .notNull()
    .references(() => categoryProperties.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  valueText:
    varchar(),

  valueNumber:
    numeric(),

  valueBoolean:
    boolean()
}, (table) => [
  unique().on(table.itemId, table.propertyId)
])

// ─── User data ──────────────────────────────────────────────────────

/**
 * User's personal equipment inventory.
 *
 * Tracks which items from the global catalog a user owns.
 */
const userEquipment = pgTable('user_equipment', {
  id:
    uuid()
    .notNull()
    .default(sql`uuidv7()`)
    .primaryKey(),

  userId:
    uuid()
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  itemId:
    uuid()
    .notNull()
    .references(() => equipmentItems.id, {
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
  unique().on(table.userId, table.itemId)
])

/**
 * Activity log for tracking user contributions.
 *
 * Records every catalog write operation (create/update/delete). Used for future gamification and reputation system.
 */
const contributions = pgTable('contributions', {
  id:
    uuid()
    .notNull()
    .default(sql`uuidv7()`)
    .primaryKey(),

  userId:
    uuid()
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),

  action:
    varchar({ length: 32 })
    .notNull(),

  targetId:
    uuid()
    .notNull(),

  metadata:
    jsonb(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})

export {
  users,
  oauthProviders,
  oauthAccounts,
  equipmentGroups,
  equipmentCategories,
  brands,
  equipmentItems,
  categoryProperties,
  propertyEnumOptions,
  itemPropertyValues,
  userEquipment,
  contributions
}
