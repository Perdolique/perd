# Catalog item detail UI

**Purpose**: Extend the shipped catalog list with the first read-only item detail page, while keeping the detail workflow separate from future inventory actions.

## Depends on

- [Catalog browse baseline UI](plan/catalog-ui-mvp.md)

## Scope

- Add the first item detail page at `/catalog/[id]`.
- Reuse the established catalog list flow and existing read APIs.
- Do not add inventory actions in this iteration.
- Do not change the list payload or reintroduce catalog filters in this iteration.

## Screen

### `/catalog/[id]`

Item detail screen.

- Fetch `GET /api/equipment/items/[id]`.
- Show item name, brand, category, status, and normalized property values.
- Keep the page read-only.
- Add only the minimal navigation needed to move from the list into the detail page and back to the list.

## Data contract rules

- Treat the current item detail payload as the upper bound for this iteration.
- If the page needs more backend data than `GET /api/equipment/items/[id]` returns today, stop and add a dedicated API iteration before extending this UI plan.
- Keep frontend data fetching simple. Do not introduce a query/cache layer in this iteration.

## Acceptance

- A signed-in user can navigate from the established `/catalog` list flow into `/catalog/[id]`.
- A signed-in user can return from `/catalog/[id]` back to the relevant catalog list flow.
- The detail page renders the current item name, brand, category, status, and normalized property values without backend changes.
- The page stays read-only, does not yet include inventory ownership actions, and does not change the list contract.
