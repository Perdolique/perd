# Equipment catalog: Implementation plan

- [Equipment browsing API](plan/browsing-api.md) — read-only endpoints for catalog navigation (groups, categories, items, brands)
- [Admin item management API](plan/admin-api.md) — CRUD for catalog data (admin only) with contribution logging
- [User inventory API](plan/user-inventory-api.md) — users add/remove items to their personal gear list
- [Seed data](plan/seed-data.md) — script to populate DB with groups, categories, properties, brands, sample items
- [Frontend](plan/frontend.md) — UI for browsing, item detail, user inventory, admin management

## Architecture decisions

Captured in `AGENTS.md`. Key points for reference:

- **EAV** for item properties (dynamic per-category, no migrations needed)
- **Groups and categories are independent** (no FK between them)
- **Items are flat** (each size/variant = separate item)
- **UUID v7** for user-facing entities, **serial** for reference data
- **Slugs** on reference data (URLs + future i18n keys), UUID on items
- **Admin-only** catalog management for MVP
- **Contributions** logged on every write for future gamification
- **Status** defaults to `approved` (admin), future user submissions default to `pending`
