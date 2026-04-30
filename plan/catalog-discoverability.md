# Catalog discoverability

**Purpose**: Improve catalog search, filtering, and URL state only after the first complete user workflow exists. This slice is intentionally downstream of ownership and packing lists.

## Depends on

- [Catalog ownership MVP](catalog-ownership-mvp.md)
- [Packing lists MVP](packing-lists-mvp.md)

## Activation rule

- Do not start this slice just because the backend already supports query parameters.
- Start it only when the shipped catalog size or real user flows prove that the current browse experience slows down ownership or packing-list tasks.

## Scope

- Revisit search and filters for the public catalog.
- Revisit URL parity only for keys the active UI truly exposes.
- Reuse existing backend query support such as `search`, `brandSlug`, `categorySlug`, `limit`, and `page` before inventing new browse contracts.

## Non-goals

- No category-first information architecture reset.
- No new browse endpoints unless the established user workflows prove the current contracts insufficient.
- No query/cache layer unless the resulting UI complexity justifies it.

## Acceptance

- The chosen discoverability controls materially improve the user-facing catalog workflow.
- The public URL includes only supported, user-visible state.
- The slice does not reopen deferred admin work or speculative browse features.
