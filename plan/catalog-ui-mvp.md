# Catalog UI MVP

**Purpose**: Ship the first user-facing catalog flow using only the existing read APIs. This iteration proves that the current browsing contracts are good enough for real navigation before we add more backend surface area.

## Scope

- Replace the placeholder home page with a real catalog entry screen.
- Add a browsable item list flow.
- Add an item detail page.
- Do not add new backend endpoints in this iteration.

## Screens

### `/`

Catalog entry screen.

- Fetch `GET /api/equipment/groups` and `GET /api/equipment/categories`.
- Present groups and categories as separate reference lists. Do not invent a relation between them.
- Provide a clear path into the catalog item list.

### `/items`

Catalog list screen.

- Fetch `GET /api/equipment/items`.
- Support existing query parameters only: `categorySlug`, `brandSlug`, `search`, `page`, and `limit`.
- Start with category-driven browsing. Brand filtering is available when a user enters the screen from a brand context or the UI already has the slug.
- Render the existing item summary payload only: item name, brand, and category.

### `/items/[id]`

Item detail screen.

- Fetch `GET /api/equipment/items/[id]`.
- Show item name, brand, category, status, and normalized property values.
- Do not add inventory actions yet. That belongs to the inventory UI iteration.

## Data contract rules

- Treat the current browsing read payloads as the upper bound for this iteration.
- If a screen needs more backend data than the current APIs return, stop and add a dedicated API iteration immediately before the affected UI slice instead of silently extending this plan.
- Keep frontend data fetching simple. Do not introduce a query/cache layer in this iteration.

## Acceptance

- A signed-in user can open `/`, navigate into `/items`, and reach `/items/[id]`.
- The item list and item detail screens work from the existing read APIs without backend changes.
- The UI does not rely on any implied group-to-category relationship.
