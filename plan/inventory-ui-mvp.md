# Inventory UI MVP

**Purpose**: Turn the catalog from a read-only experience into the first useful user workflow. After this iteration, a signed-in user can mark items they own and review that list in one dedicated place.

## Depends on

- [Catalog UI MVP](plan/catalog-ui-mvp.md)
- [User inventory API](plan/user-inventory-api.md)

## Screens and actions

### `/items/[id]`

Add the first inventory action to the existing item detail page.

- Fetch the item detail exactly as in the catalog UI iteration.
- Add an "I have this" action that calls `POST /api/user/equipment`.
- Show a remove action only after the page knows the user already has the item. Use the inventory row id from the inventory API for deletion.

### `/inventory`

Personal inventory page.

- Fetch `GET /api/user/equipment`.
- Render each row with the existing minimal summary payload: inventory row id, item name, brand, category, and `createdAt`.
- Allow removing a row with `DELETE /api/user/equipment/[id]`.

## UI rules

- Keep the interactions optimistic only if the implementation can recover cleanly from `409` and other request failures. Otherwise use explicit loading and refresh states.
- Do not add item editing, notes, quantities, or custom user metadata in this iteration.
- Reuse the existing browsing screens and components before creating new abstractions.

## Acceptance

- A signed-in user can add an approved item from its detail page.
- The item then appears on `/inventory`.
- The same user can remove the inventory row and see the list update.
