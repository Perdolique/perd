# Perd - Outdoor equipment companion

## Technical stack

- Nuxt 4 (with Nuxt 5 compatibility flag enabled)
- Drizzle ORM
- Neon PostgreSQL

## Equipment architecture

### Data model

- **EAV (Entity-Attribute-Value)** for item properties: `category_properties` defines what properties a category has, `item_property_values` stores actual values per item. This enables dynamic filters and item comparison without schema migrations.
- **Two-level categorization**: Groups (functional area: Sleep, Shelter, Cooking) and Categories (specific type: Sleeping Bags, Sleeping Pads) are independent entities with no FK relationship. Connection can be added later when navigation patterns become clear.
- **Items are flat** — each size/variant is a separate item. Size is a category property, not a separate variant system.

### Database conventions

- **UUID v7** as PK for all user-facing entities (items, user_equipment, contributions).
- **Serial** PK for reference data (groups, categories, properties, brands).
- **Slugs** on reference data only (groups, categories, brands) — used for URLs and as future i18n translation keys. Items use UUID in URLs.
- **`name`** columns on reference data are English display values. When i18n is added, `slug` maps to a translation key, `name` becomes the fallback.

### Content management

- **Contributions table** logs every write operation (create/update/delete) with userId, action, targetId, and optional metadata. Used for future gamification.
- **Item status**: `approved` by default for admin-created items. Future user submissions will default to `pending`.
- MVP: only admins can manage the equipment catalog. Users browse and add items to their inventory.

### Schema file

All tables live in a single `server/database/schema.ts` file, organized by sections: Auth, Equipment catalog, User data.

## Workflow

Before performing any task, action, or code modification, event small one, check if there are existing skills that cover the domain of your task and follow their instructions.

After any code modification, always run:

- If Markdown files are modified:
  - `pnpm run lint:markdown` for markdown linting
- If TypeScript or Vue code is modified:
  - `pnpm run test:typecheck` - to ensure type safety
  - `pnpm run test:unit:agent` for unit tests
  - `pnpm run lint:oxlint` for linting
  - `pnpm run build` to ensure the project builds successfully
  - `pnpm run test:e2e:ci` for E2E tests (auto-starts dev server)

All tasks above can be run in parallel.

If any architectural decisions were made during the task (new patterns, conventions, data model changes), update relevant sections of this file. Remove or revise entries that are no longer accurate.
