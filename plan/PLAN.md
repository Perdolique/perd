# Perd roadmap

[Completed work](completed.md) — implemented product and platform slices.
[Technical debt](tech-debt.md) — accepted engineering follow-up work that is intentionally deferred.
[Architecture notes](../docs/architecture/container-queries.md) — responsive CSS decision rules that are no longer part of the product roadmap.

## Active iteration order

- [Packing lists MVP](packing-lists-mvp.md) — the first trip-oriented checklist flow with catalog-backed and custom entries
- [Catalog discoverability](catalog-discoverability.md) — search/filter/URL work only after the first complete user workflow ships

## Deferred product work

- [Admin catalog operations](admin-catalog-operations.md) — item create/edit/delete tooling stays behind the user-facing MVP unless catalog maintenance becomes a proven blocker

## Planning rules

- Keep `plan/PLAN.md` as a short index of active and intentionally deferred roadmap slices only.
- Move shipped detail into `plan/completed.md` instead of keeping stale execution specs in active roadmap files.
- Prefer vertical slices that ship one complete user workflow over separate API/UI micro-iterations.
- Treat existing read contracts as the default frontend source until a concrete user workflow proves they are insufficient.
- Keep parked architecture guidance and implementation audits out of the active roadmap surface.
