# Catalog list URL parity

**Purpose**: Extend the shipped `/catalog` list flow to honor the existing item-list query contract without expanding the visible controls on the page.

## Depends on

- [Catalog browse baseline UI](plan/catalog-ui-mvp.md)

## Scope

- Support existing `brandSlug`, `search`, and `limit` query parameters on `/catalog`.
- Preserve `brandSlug`, `search`, and `limit` when paginating instead of stripping them from the URL.
- Support deep links that already contain any compatible combination of `categorySlug`, `brandSlug`, `search`, `page`, and `limit`.
- Do not add new backend endpoints in this iteration.
- Do not add new visible controls for brand filtering, search, or page size.

## Screen

### `/catalog`

Catalog list page.

- Reuse the existing list page from the baseline iteration.
- Continue using route query as the single source of truth for list state.
- Honor `brandSlug`, `search`, and `limit` when they are already present in the URL.
- Keep category-first browsing; URL compatibility for additional filters must not turn into a broader browse UI redesign.

## Data contract rules

- Treat the current browsing read payloads as the upper bound for this iteration.
- If supporting URL parity reveals a missing backend field or filter behavior, stop and add a dedicated API iteration before changing the UI plan.
- Keep frontend data fetching simple. Do not introduce a query/cache layer in this iteration.

## Acceptance

- A signed-in user can open a deep link containing existing compatible list query parameters and get a working `/catalog` list without backend changes.
- The list preserves `brandSlug`, `search`, and `limit` when paginating.
- The page still does not expose a brand browser, search form, or limit selector.
- The iteration does not require item detail or inventory ownership actions to feel complete.
