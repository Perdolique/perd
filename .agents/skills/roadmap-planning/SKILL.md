---
name: roadmap-planning
description: Roadmap and implementation-planning workflow for the Perd project. Use when editing `plan/**`, changing roadmap order, moving shipped work into completed notes, or turning a feature/refactor into implementation iterations. Do not use for generic Markdown cleanup, README/docs copy edits, or code-only changes.
---

# Roadmap Planning Workflow

Use this skill to keep `plan/` as a small, implementation-oriented roadmap instead of a backlog dump. Roadmap files should tell the next engineer what to build, what not to build, and how to know the slice is done.

## Use cases

Use this skill for:

- editing files under `plan/**`
- changing `plan/ROADMAP.md` order, links, or section membership
- splitting product, backend, frontend, or test work into implementation iterations
- moving shipped work from an active plan into `plan/completed.md`
- recording accepted follow-up work in `plan/tech-debt.md`

Do not use this skill for generic Markdown cleanup, README/docs copy edits, architecture notes that do not affect roadmap decisions, or code-only changes. If code changes also require roadmap updates, use the relevant code skill plus this one.

## Roadmap model

- `plan/ROADMAP.md` is the top-down index and source of truth for work order.
- Active roadmap files hold only work that still matters for upcoming implementation.
- `plan/completed.md` is a short factual journal, not an archive of execution detail.
- `plan/tech-debt.md` is for accepted engineering follow-up after a smaller slice ships.
- Deferred product files should explain their return conditions instead of acting as open-ended wishlists.

## Editing workflow

1. Read `plan/ROADMAP.md` and the target plan file before changing roadmap content.
2. Classify the change as active roadmap, deferred product work, engineering follow-up, or completed work.
3. Keep links and section membership in `plan/ROADMAP.md` synchronized with renamed, moved, added, or completed plan files.
4. Remove stale roadmap detail when work ships. Preserve only the short completed summary needed in `plan/completed.md`.
5. Move new follow-up ideas to `plan/tech-debt.md` or a deferred roadmap file instead of leaving TODOs inside completed or active shipped sections.

## Iteration contract

Every active iteration should include:

- **Result**: the user-visible outcome or independently validated engineering contract.
- **Scope**: the smallest set of surfaces needed for that result.
- **Non-goals**: explicit boundaries that prevent adjacent work from leaking into the slice.
- **Verification**: focused tests or commands that prove the slice, with broader checks only when the touched area warrants them.
- **Completed summary**: one short sentence ready to move into `plan/completed.md` after shipment.

When drafting or revising iterations:

- Prefer the smallest completed iteration that removes one blocker or delivers one coherent slice.
- Use API-only or data-only iterations only when they produce a standalone contract that can be validated independently.
- Do not add speculative phases, abstractions, payload fields, endpoints, joins, URL keys, or UI controls.
- For API/data plans, every returned field, join, and filter must be justified by the current iteration's consumer or verification target.
- Treat response examples as the upper bound for that iteration's payload. Do not silently extend them while implementing.
- Reuse existing contracts before planning new endpoints or broader payloads.

## Writing style

- Keep planning docs in English.
- Prefer concrete behavior and current constraints over generic platform-speak.
- State assumptions and activation rules directly when work is deferred.
- Remove stale guidance instead of appending contradictory notes on top of it.

