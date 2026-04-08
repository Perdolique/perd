# Completed work

Summary of already implemented features.

## Database foundation

Full schema with migrations: auth tables (`users`, `oauth_providers`, `oauth_accounts`), equipment catalog (`equipment_groups`, `equipment_categories`, `brands`, `equipment_items`), EAV layer (`category_properties`, `property_enum_options`, `item_property_values`), user data (`user_equipment`, `contributions`). Drizzle ORM relations configured.

## Authentication and sessions

Guest session creation, logout, session middleware protecting `/api/*` routes. Browser visits to protected API URLs redirect through `/login` and restore the original API document after login, while programmatic API requests still receive `401`. `validateSessionUser()` and `validateAdminUser()` utilities for endpoint authorization. Admin authorization resolves the current role from the database, so role checks do not depend on stale session flags.

## Equipment browsing API

Authenticated read-only catalog endpoints for groups, categories, brands, item lists, and item detail. The shipped browsing surface is the current frontend baseline: groups and categories stay independent reference data, category detail includes enum options only where they matter, brand detail stays intentionally narrow, and item list/detail responses provide the catalog contract that future UI slices should reuse before asking for new backend joins.

## Admin reference-data management

Admin-only Brands, Groups, and Categories CRUD is implemented under `/api/equipment/brands`, `/api/equipment/groups`, and `/api/equipment/categories`, including the shared validation and contribution logging conventions that later item writes will reuse. Category property and enum option management is implemented under nested category routes so admins can define EAV metadata before item creation. Public detail reads stay on `slug`, while admin `PATCH` and `DELETE` use stable numeric `id`. Brand/category usage by `equipment_items` is protected at the FK level with `restrict` deletes so reference cleanup cannot cascade into catalog or user inventory records. Enum option deletes are blocked with `409` when the option slug is already used by existing item property values.

## Frontend foundation

Application shell, login, account, and OAuth callback pages are implemented. The homepage is still only a placeholder, so real catalog and inventory screens remain active roadmap work rather than completed UI slices.

## Twitch OAuth

Redirect to Twitch, token exchange, user info fetch, new user creation with OAuth account linking, login via existing Twitch account, and redirect restoration through OAuth `state`. Missing: CSRF-hardening for `state`, linking existing account to Twitch.

## Shared UI components

Nuxt layout with header, footer, sidebar. Shared UI components: buttons, cards, dialogs, menu, heading, link, spinner. CSS design tokens for colors, spacing, typography, transitions.

## Tooling and tests

Migration CLI script (`tools/migrate.ts`). Playwright browser smoke for login rather than API contract coverage. DB-free Vitest coverage for brands/groups/categories admin handlers, brand/category/item read handlers, and shared validation schemas. Unit tests for `withMinimumDelay` utility.

## Seed data

Catalog seed CLI implemented with `drizzle-seed` for reset/reference data and plain Drizzle inserts for EAV rows. Includes local (`db:seed:local`) and CI/staging (`db:seed`) entrypoints, PR staging workflow integration, deterministic groups/categories/brands, and sample items covering seeded `number`, `enum`, and `boolean` property values with validation that each property is written to the correct `value*` column.
