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
- **Reference data slugs are canonical lowercase URL tokens** using only `a-z`, `0-9`, and single hyphens between segments.
- **`name`** columns on reference data are English display values. When i18n is added, `slug` maps to a translation key, `name` becomes the fallback.
- **Brand/category FKs from `equipment_items` must not cascade on delete**: use `restrict` so deleting reference data cannot silently remove catalog items, item property values, or user inventories.

### API conventions

- **Public read routes for reference data use `slug`** in detail URLs (`/api/equipment/brands/[slug]`, `/api/equipment/categories/[slug]`).
- **Admin mutation routes for reference data use `id`** in route params (`PATCH`/`DELETE`), because `slug` is editable content and must not be the stable mutation key.
- **Admin category property mutations stay nested under category `id` routes** (`/api/equipment/categories/[categoryId]/properties/...`) so parent ownership is explicit and property/enum-option handlers can verify the full route chain.
- **All API request inputs use Valibot schemas through h3 validated helpers**: `readValidatedBody` for request bodies, `getValidatedRouterParams` for route params, and `getValidatedQuery` for query strings. Schemas and validator functions live in `server/utils/validation/schemas.ts`; handlers should consume parsed values instead of manually validating raw input.
- **Catalog admin writes that both mutate reference data and log `contributions` must be atomic**: run them through a transaction-capable write path, not separate `dbHttp` calls.
- **Single-result query arrays should be destructured directly from the awaited query** when only the first row is needed once (`const [row] = await ...`); keep an intermediate array only when the full result set, row count, or repeated reuse matters.
- **Public read detail endpoints stay narrow**: return the entity needed for that route, and fetch related collections with separate read endpoints when a page needs them. Do not expand detail payloads just to save a future frontend request.
- **Shared catalog `returning(...)` shapes use reusable base records, not global endpoint models**: extract common `id`/`name`/`slug` selections into server-only helpers when reused, but keep each endpoint free to return a different response shape later if needed.
- **Deleting an enum option that is already used by existing item property values must return `409`**: enum item values are currently stored by slug text, so option deletes need an application-level guard against orphaned enum values.
- **Protected `/api/*` routes keep mixed auth behavior by caller type**: unauthenticated browser document navigations redirect to `/login?redirectTo=...`, while programmatic API requests (`fetch`/XHR) still receive `401`.

### Testing conventions

- **API handlers are tested in Vitest with mocks** for `event`, `dbHttp`, and auth/body helpers. Required API coverage must not depend on shared database state.
- **Playwright is reserved for browser/UI smoke** and must not be the primary layer for API contract coverage.
- **Deterministic tests over seeded assumptions**: avoid checks that depend on fixed counts or specific catalog rows in a real database.
- **Shared test helpers live at the repo root** (for example `test-utils/`), not inside `server/` or `app/`, so runtime source trees stay free of test-only utilities. Import them through root aliases like `~~/` or `@@/`, not deep relative paths.
- **Avoid file-level lint disables in tests** when a clean test helper, typed wrapper, or test-specific lint override can solve the problem. Use inline/file disables only as a last resort for a documented tool mismatch.
- **Prefer `vi.mock(import(...))` in Vitest** so test mocks stay aligned with the project skill and `vitest/prefer-import-in-mock`. If a test needs leniency, prefer narrow `oxlint` test overrides like `max-lines` or `import/no-relative-parent-imports`, not disabling mock-style rules.

### Content management

- **Contributions table** logs every write operation (create/update/delete) with userId, action, targetId, and optional metadata. `targetId` stores the changed entity's primary key as a string, so it can hold either a serial ID or a UUID. Used for future gamification.
- **Item status**: `approved` by default for admin-created items. Future user submissions will default to `pending`.
- MVP: only admins can manage the equipment catalog. Users browse and add items to their inventory.

### Schema file

All tables live in a single `server/database/schema.ts` file, organized by sections: Auth, Equipment catalog, User data.

## Workflow

Before performing any task, action, or code modification, event small one, check if there are existing skills that cover the domain of your task and follow their instructions.

- Files imported by standalone Node/`tsx` scripts (for example migration, seed, and other `tools/*.ts` entry points, plus their transitive dependencies) must not rely on Nuxt-only aliases like `~/` or `@@/`. If such files use `#shared/*` or `#server/*`, keep those aliases backed by `package.json#imports`, because plain script execution does not get Nuxt alias resolution automatically.

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
If a task changes architecture, route conventions, or test strategy, update `AGENTS.md` and relevant roadmap/completed docs in the same change automatically.

## Planning conventions

The `plan/` directory is the **global product roadmap**, not a per-sprint task list. It describes the full scope of planned product features and their implementation order.

- Prefer the **smallest possible completed iteration** that removes one blocker or delivers one coherent slice. Smaller iterations reduce implementation mistakes and make progress easier to verify.
- For new API iterations, every join must be justified by a field returned in the current response or by a filter applied in the current endpoint. Do not preload relations "just in case".
- Do not add extra detail payload or extra detail endpoints unless the current iteration already has a concrete consumer for them.
- Response examples in plan files are the **upper bound** for payload in that iteration. Do not silently extend them without updating the plan and the consumer need.
- `plan/PLAN.md` is the roadmap index — keep it short, link to detailed plan files.
- Large iterations must be split into sequential task files (e.g. `plan/admin-management/01-foundations.md`).
- Completed work goes to `plan/completed.md` as short summaries, not detailed specs.
- When plan files are renamed or moved, update links in `plan/PLAN.md` and overview files immediately.
