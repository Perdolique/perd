# Catalog discoverability

**Purpose**: Improve catalog search, filtering, and URL state only after the first complete user workflow exists. This slice is intentionally downstream of ownership and packing lists.

## Depends on

- Catalog ownership, already summarized in [Completed work](completed.md)
- [Packing lists MVP](packing-lists-mvp.md)

## Activation rule

- Do not start this slice just because the backend already supports query parameters.
- Start it only when the shipped catalog size or real user flows prove that the current browse experience slows down ownership or packing-list tasks.

## Scope

- Start with one user-visible control, most likely search, instead of adding search, brand filters, category filters, and URL parity together.
- Revisit URL parity only for keys the active UI truly exposes.
- Reuse existing backend query support such as `search`, `brandSlug`, `categorySlug`, `limit`, and `page` before inventing new browse contracts.
- Add brand or category filters only after search and the packing flow show a concrete need for those controls.

## Non-goals

- No category-first information architecture reset.
- No new browse endpoints unless the established user workflows prove the current contracts insufficient.
- No query/cache layer unless the resulting UI complexity justifies it.

## Acceptance

- The chosen discoverability control improves an observed ownership or packing-list workflow.
- The public URL includes only supported, user-visible state.
- The slice does not reopen deferred admin work or speculative browse features.
- Any follow-up controls are listed as separate iterations instead of being bundled into the first discoverability change.