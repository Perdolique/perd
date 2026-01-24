# Drizzle Schema Formatting

Each table field on separate lines with proper indentation and line breaks between method calls.

## Field Declaration Pattern

```typescript
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
    .defaultNow()
})
```

## Formatting Rules

1. **Long chains**: Break after field name, each method on new line with indentation
2. **Simple fields**: Single-line if no chaining (e.g., `name: varchar({ length: 100 })`)
3. **Object params**: Multi-line if complex, single-line if simple
4. **Blank lines**: Between fields for readability
5. **Constraints**: Index definitions after closing brace in callback

## Why This Format

- Clear visual separation between fields
- Easy to scan and understand field definitions
- Consistent with project schema patterns
- Better diffs when modifying fields

## Examples

### Simple Field

```typescript
name: varchar({
  length: 100
})
```

### Field with Chaining

```typescript
email:
  varchar({
    length: 255
  })
  .notNull()
  .unique()
```

### Indexes

```typescript
export const users = pgTable('users', {
  id: ulid()
    .notNull()
    .primaryKey(),

  email:
    varchar({ length: 255 })
    .notNull(),

  name: varchar({ length: 100 })
}, (table) => [
  index().on(table.email),
  index().on(table.name)
])
```
