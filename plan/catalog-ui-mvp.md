# Catalog browse baseline UI

**Purpose**: Replace the current catalog placeholder with the first working `/catalog` browsing flow, while keeping the initial slice limited to category-first navigation and pagination.

## Scope

- Replace the placeholder at `/catalog` with a working catalog list page.
- Fetch `GET /api/equipment/categories` and `GET /api/equipment/items`.
- Support only `categorySlug` and `page` query parameters in this iteration.
- Use route query as the single source of truth for the list state.
- Keep category switching URL-driven. If the list UI changes the selected category, it must update `categorySlug` in the route instead of storing a separate hidden state.
- Render the existing item summary payload only: item name, brand, and category.
- Include only the states needed to finish the list workflow: loading, request failure, empty results, and paginated results.
- Do not add new backend endpoints in this iteration.
- Do not change `/` beyond existing shell-level placeholder behavior.
- Do not add `brandSlug`, `search`, or `limit` support in this iteration.
- Do not add special handling for unrelated query parameters while paginating.
- Do not add item click-through, inventory actions, dashboard promos, or "coming soon" blocks.

## Screen

### `/catalog`

Catalog list page.

- Start with category-first browsing on the existing categories read API.
- If no `categorySlug` is present, the page may show all approved items from the existing list API.
- Do not add a brand browser, search form, limit selector, or any non-working group-based navigation in this iteration.
- Do not preserve unrelated query parameters during pagination in this iteration; URL parity for those parameters is a separate follow-up slice.
- Do not add any card or callout that exists only to advertise later iterations.

## Data contract rules

- Treat the current browsing read payloads as the upper bound for this iteration.
- If a screen needs more backend data than the current APIs return, stop and add a dedicated API iteration immediately before the affected UI slice instead of silently extending this plan.
- Keep frontend data fetching simple. Do not introduce a query/cache layer in this iteration.

## Acceptance

- A signed-in user can open `/catalog` directly and get a working list without visiting `/`.
- A signed-in user can deep-link into `/catalog?categorySlug=<slug>` and get a working list without backend changes.
- The item list screen uses route query as the only persisted list state.
- The item list screen supports pagination through the existing `page` parameter.
- The UI does not expose unfinished group-based navigation or rely on any implied group-to-category relationship.
- The iteration does not require `/`, URL parity for other filters, item detail, or inventory ownership actions to feel complete.
