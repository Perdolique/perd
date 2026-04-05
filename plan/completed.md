# Completed work

Summary of already implemented features.

## Database foundation

Full schema with migrations: auth tables (`users`, `oauth_providers`, `oauth_accounts`), equipment catalog (`equipment_groups`, `equipment_categories`, `brands`, `equipment_items`), EAV layer (`category_properties`, `property_enum_options`, `item_property_values`), user data (`user_equipment`, `contributions`). Drizzle ORM relations configured.

## Authentication and sessions

Guest session creation, logout, session middleware protecting `/api/*` routes. Browser visits to protected API URLs redirect through `/login` and restore the original API document after login, while programmatic API requests still receive `401`. `validateSessionUser()` and `validateAdminUser()` utilities for endpoint authorization. Admin authorization resolves the current role from the database, so role checks do not depend on stale session flags.

## Equipment browsing API

Authenticated read-only catalog endpoints for groups, categories, brands, item lists, and item detail. Includes category property definitions with enum options, narrow brand detail metadata, and item pagination/filtering.

## Admin catalog management

Admin-only Brands and Groups CRUD implemented under `/api/equipment/brands` and `/api/equipment/groups`. Public detail reads stay on `slug`, while admin `PATCH` and `DELETE` use stable numeric `id`. Successful create, update, and delete operations log to `contributions`.

## Twitch OAuth

Redirect to Twitch, token exchange, user info fetch, new user creation with OAuth account linking, login via existing Twitch account, and redirect restoration through OAuth `state`. Missing: CSRF-hardening for `state`, linking existing account to Twitch.

## App shell and frontend foundation

Nuxt layout with header, footer, sidebar. Login page, account page, Twitch callback page. Shared UI components: buttons, cards, dialogs, menu, heading, link, spinner. CSS design tokens for colors, spacing, typography, transitions.

## Tooling and tests

Migration CLI script (`tools/migrate.ts`). Playwright browser smoke for login rather than API contract coverage. DB-free Vitest coverage for brands admin/read handlers, category read handler, item read handlers, and shared validation schemas. Unit tests for `withMinimumDelay` utility.

## Seed data

Catalog seed CLI implemented with `drizzle-seed` for reset/reference data and plain Drizzle inserts for EAV rows. Includes local (`db:seed:local`) and CI/staging (`db:seed`) entrypoints, PR staging workflow integration, deterministic groups/categories/brands, and sample items covering seeded `number`, `enum`, and `boolean` property values with validation that each property is written to the correct `value*` column.
