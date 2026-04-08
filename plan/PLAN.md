# Equipment catalog: Active roadmap

[Completed work](plan/completed.md) — implemented product and platform slices.
[Technical debt](plan/tech-debt.md) — accepted follow-up work that is intentionally deferred.

Architecture decisions are captured in `AGENTS.md`.

## Active iteration order

1. [Catalog UI MVP](plan/catalog-ui-mvp.md) — first user-facing catalog flow built only on the existing browsing read APIs
1. [User inventory API](plan/user-inventory-api.md) — list, add, and remove items in a user's personal gear list
1. [Inventory UI MVP](plan/inventory-ui-mvp.md) — user inventory page plus "I have this" actions from the catalog UI
1. [Admin item management overview](plan/admin-api.md) — shared rules for the remaining admin item lifecycle work
1. [Admin item creation API](plan/admin-item-create-api.md) — transactional item creation with property values and contribution logging
1. [Admin item creation UI](plan/admin-item-create-ui.md) — minimal admin form for creating catalog items
1. [Admin item maintenance API](plan/admin-item-maintenance-api.md) — update and delete existing catalog items
1. [Admin item maintenance UI](plan/admin-item-maintenance-ui.md) — minimal admin edit and delete flows for items

## Planning rules

- Keep active roadmap files limited to work that is still ahead of us. Move shipped detail into `plan/completed.md` instead of leaving stale execution specs in the main flow.
- Add a new API iteration only when a concrete screen or user workflow needs it.
- Treat existing browsing read contracts as the default frontend data source unless a UI slice proves they are insufficient.
