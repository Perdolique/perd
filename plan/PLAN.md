# Equipment catalog: Active roadmap

[Completed work](plan/completed.md) — implemented product and platform slices.
[Technical debt](plan/tech-debt.md) — accepted follow-up work that is intentionally deferred.
[Container queries audit](plan/container-queries-audit.md) — responsive CSS decision rules and the current UI audit.

Architecture decisions are captured in `AGENTS.md`.

## Active iteration order

- [Catalog item detail UI](plan/catalog-item-detail-ui.md) — first read-only item detail screen linked from the established catalog list flow
- [User inventory API](plan/user-inventory-api.md) — list, add, and remove items in a user's personal gear list
- [Inventory UI MVP](plan/inventory-ui-mvp.md) — user inventory page plus "I have this" actions from the item detail flow
- [Admin item management overview](plan/admin-api.md) — shared rules for the remaining admin item lifecycle work
- [Admin item creation API](plan/admin-item-create-api.md) — transactional item creation with property values and contribution logging
- [Admin item creation UI](plan/admin-item-create-ui.md) — minimal admin form for creating catalog items
- [Admin item maintenance API](plan/admin-item-maintenance-api.md) — update and delete existing catalog items
- [Admin item maintenance UI](plan/admin-item-maintenance-ui.md) — minimal admin edit and delete flows for items

## Planning rules

- Keep active roadmap files limited to work that is still ahead of us. Move shipped detail into `plan/completed.md` instead of leaving stale execution specs in the main flow.
- Add a new API iteration only when a concrete screen or user workflow needs it.
- Treat existing browsing read contracts as the default frontend data source unless a UI slice proves they are insufficient.
- Treat user-space catalog URLs as a frontend contract with only the keys that the current screen actually supports.
- Each UI iteration must ship one complete in-scope workflow. Do not add placeholder blocks, teaser copy, or navigation to unfinished product slices inside that iteration.
- Shell-level placeholder routes are acceptable only when they stay outside the iteration scope, acceptance, and primary navigation for the active workflow.
