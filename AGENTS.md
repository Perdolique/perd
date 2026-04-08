# Perd - Outdoor equipment companion

## Technical stack

- Nuxt 4 (with Nuxt 5 compatibility flag enabled)
- Drizzle ORM
- Neon PostgreSQL

## Core project invariants

- Equipment properties use an EAV model: `category_properties` defines available fields, `item_property_values` stores per-item values.
- Groups and categories are separate reference entities with no FK between them. Do not invent one unless the product plan explicitly changes.
- Items are flat. Size and similar distinctions are category properties, not a variant subsystem.
- User-facing catalog entities use UUID v7 where the product already depends on stable public IDs. Reference data uses serial IDs.
- Reference-data slugs are canonical lowercase URL tokens using only `a-z`, `0-9`, and single hyphens.
- Reference-data `name` values stay English display strings. Slugs are the durable keys for URLs and future i18n lookups.
- `equipment_items` brand/category foreign keys must stay non-cascading (`restrict`), so deleting reference data cannot silently remove catalog or inventory records.
- Public reference-data read routes use `slug`; admin mutations use stable `id` params.
- All tables live in `server/database/schema.ts`, organized by Auth, Equipment catalog, and User data sections.

## Local skills

Before any task, check whether a local skill matches the domain and follow it.

- `vue-components` for `.vue` component structure, styling, props/emits, and SSR-safe frontend patterns.
- `equipment-backend` for equipment/catalog backend work in `server/api`, validation schemas, Drizzle write paths, schema changes, and equipment API tests.
- `planning-docs` for roadmap files in `plan/`, completed work notes, architecture docs, and iteration planning tasks.

## Workflow rules

- Files imported by standalone Node or `tsx` scripts, including `tools/*.ts`, migrations, seeds, and their transitive dependencies, must not rely on Nuxt-only aliases like `~/` or `@@/`. If they use `#shared/*` or `#server/*`, keep those aliases backed by `package.json#imports`.
- After any architecture, route-convention, data-model, or test-strategy change, update the relevant docs in the same change. This can include `AGENTS.md`, `plan/PLAN.md`, `plan/completed.md`, or the detailed roadmap file that changed.

## Verification matrix

After any code modification, run the checks that match the files you touched.

- If Markdown files changed: `pnpm run lint:markdown`
- If TypeScript or Vue code changed: `pnpm run test:typecheck`
- If TypeScript or Vue code changed: `pnpm run test:unit:agent`
- If TypeScript or Vue code changed: `pnpm run lint:oxlint`
- If TypeScript or Vue code changed: `pnpm run build`
- If TypeScript or Vue code changed: `pnpm run test:e2e:ci`

All applicable commands may be run in parallel.
