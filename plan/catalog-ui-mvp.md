# Catalog browse baseline UI

**Purpose**: Replace the current catalog placeholder with the first working `/catalog` browsing flow, while keeping the initial slice limited to a compact all-items list and pagination.

## Scope

- Replace the placeholder at `/catalog` with a working catalog list page.
- Fetch only `GET /api/equipment/items` for this iteration.
- Support only `page` in the user-space URL for this iteration.
- Use route query as the single source of truth for pagination state.
- Render the existing item summary payload only: item name, brand, and category.
- Present the list as a compact table-like view rather than large cards.
- Include only the states needed to finish the list workflow: loading, request failure, empty results, and paginated results.
- Do not add new backend endpoints in this iteration.
- Do not change `/` beyond existing shell-level placeholder behavior.
- Do not add visible filters, search, grouping UI, item click-through, inventory actions, dashboard promos, or "coming soon" blocks.

## Screen

### `/catalog`

Catalog list page.

- Show all visible catalog items from the existing list API.
- Keep the page UI intentionally minimal: page title, short item count summary, compact table-like list, and pagination.
- Keep unsupported query keys out of the page state; only `page` is part of the public contract for this slice.
- Do not expose brand, category, or group browsing controls in this iteration.

## Data contract rules

- Treat the current browsing read payloads as the upper bound for this iteration.
- If a screen needs more backend data than the current APIs return, stop and add a dedicated API iteration immediately before the affected UI slice instead of silently extending this plan.
- Keep frontend data fetching simple. Do not introduce a query/cache layer in this iteration.

## Acceptance

- A signed-in user can open `/catalog` directly and get a working list without visiting `/`.
- A signed-in user can deep-link into `/catalog?page=<n>` and get a working list without backend changes.
- The item list screen uses route query as the only persisted pagination state.
- The item list screen supports pagination through the existing `page` parameter.
- The UI does not expose unfinished filters, group-based navigation, item detail links, or inventory actions.
- The iteration does not require `/`, extra URL parity, item detail, or inventory ownership actions to feel complete.
