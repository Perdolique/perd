# Perd roadmap

This file is the source of truth for the order of upcoming work. Each active item should be small enough to finish, validate, and then remove from this list or summarize in [Completed work](completed.md).

## Now

- [Custom checklist entries](packing-lists-mvp.md#iteration-2-custom-checklist-entries) — make one packing list useful without catalog coverage; done when custom entries can be added, packed/unpacked, and removed.

## Next

- [Catalog-backed packing entries](packing-lists-mvp.md#iteration-3-catalog-backed-packing-entries) — connect catalog detail to packing lists; done when an approved catalog item can be added from `/catalog/[id]` to an existing packing list.
- [Packing navigation decision](packing-lists-mvp.md#iteration-4-packing-navigation-decision) — decide how packing becomes the primary workflow; done when navigation and `/` behavior match the shipped packing experience.

## Deferred product work

- [Catalog discoverability](catalog-discoverability.md) — search/filter/URL work waits until shipped ownership and packing flows prove browse friction.
- [Admin catalog operations](admin-catalog-operations.md) — item create/edit/delete tooling stays behind the user-facing MVP unless catalog maintenance becomes a proven blocker.

## Engineering follow-up

- [Technical debt](tech-debt.md) — accepted engineering work that is intentionally deferred.
- [Architecture notes](../docs/architecture/container-queries.md) — stable responsive CSS decision rules, not active product roadmap work.
- [Completed work](completed.md) — short shipped-work journal.

## Planning rules

- Keep this file as a short top-down index. Detailed execution notes belong only in the active iteration file.
- Every iteration must state its result, scope boundaries, non-goals, touched surfaces, required verification, and completed-work summary.
- Prefer the smallest vertical slice that delivers one coherent user result. Use API-only work only when it produces a standalone contract that can be validated independently.
- After an iteration ships, remove or collapse its active detail and add a short factual entry to [Completed work](completed.md).
- Move new follow-up ideas to [Technical debt](tech-debt.md) or a deferred roadmap file instead of leaving TODOs inside completed work.
