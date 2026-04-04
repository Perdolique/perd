# Equipment catalog: Implementation plan

[Completed work](plan/completed.md) — summary of already implemented features.

Architecture decisions are captured in `AGENTS.md`.

## Iteration order

### 1. Browsing API

- [Equipment browsing API](plan/browsing-api.md) — read-only endpoints for catalog navigation (groups, categories, items, brands)

### 2. Admin catalog management

- [Admin management overview](plan/admin-api.md) — CRUD for catalog data (admin only) with contribution logging

Tasks in execution order:

1. [Foundations](plan/admin-management/01-foundations.md) — shared patterns for all admin endpoints
1. [Brands CRUD](plan/admin-management/02-brands.md) — create, update, delete brands
1. [Groups CRUD](plan/admin-management/03-groups.md) — create, update, delete groups
1. [Categories CRUD](plan/admin-management/04-categories.md) — create, update, delete categories
1. [Category properties](plan/admin-management/05-category-properties.md) — manage property definitions and enum options
1. [Item creation](plan/admin-management/06-items-create.md) — create items with property values (multi-table transaction)
1. [Item maintenance](plan/admin-management/07-items-maintenance.md) — update and delete items

### 3. User inventory

- [User inventory API](plan/user-inventory-api.md) — users add/remove items to their personal gear list

### 4. Frontend

- [Frontend](plan/frontend.md) — UI for browsing, item detail, user inventory, admin management

## Someday

- **Vitest integration tests for API handlers** — currently API tests run via Playwright (full build + preview server). A dedicated test DB (local Neon or pg docker) + Vitest test utils for h3 (`createEvent`) would make API tests faster and independent from the E2E suite.
