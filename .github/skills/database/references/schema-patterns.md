# Database Schema Patterns

Define schemas in `server/database/schema.ts`. Import tables in API routes from `#server/utils/database`.

**Official Docs**: [Drizzle SQL Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)

## Basic Table Schema

```typescript
import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { ulid } from '#server/utils/ulid'
import { limits } from '~~/constants'

export const users = pgTable('users', {
  id:
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name: varchar({
    length: limits.maxUserNameLength
  }),

  email:
    varchar({
      length: 255
    })
    .notNull()
    .unique(),

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
  index().on(table.name),
  index().on(table.email)
])
```

## Table with Foreign Keys

```typescript
export const equipment = pgTable('equipment', {
  id:
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name:
    varchar({
      length: limits.maxEquipmentNameLength
    })
    .notNull(),

  brandId:
    integer()
    .references(() => brands.id, {
      onDelete: 'set null'
    }),

  creatorId:
    ulid()
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade'
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
    .$onUpdate(() => sql`now()`)
}, (table) => [
  index().on(table.brandId),
  index().on(table.creatorId)
])
```

## Table with Enums and JSON

```typescript
import { pgEnum, jsonb } from 'drizzle-orm/pg-core'

export const equipmentStatusEnum = pgEnum('equipment_status', [
  'active',
  'retired',
  'lost'
])

export const equipment = pgTable('equipment', {
  id:
    ulid()
    .notNull()
    .default(sql`gen_ulid()`)
    .primaryKey(),

  name:
    varchar({
      length: 100
    })
    .notNull(),

  status:
    equipmentStatusEnum()
    .notNull()
    .default('active'),

  metadata: jsonb().$type<{
    tags: string[];
    notes: string;
  }>(),

  createdAt:
    timestamp({
      withTimezone: true
    })
    .notNull()
    .defaultNow()
})
```

## Key Principles

- Always use indexes on foreign keys
- Use `timestamp({ withTimezone: true })` for dates
- Auto-update timestamps with `.$onUpdate(() => sql`now()`)`
- ULID for primary keys via `ulid()` helper
- Define length limits from `constants.ts`
