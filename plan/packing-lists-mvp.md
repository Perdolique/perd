# Packing lists MVP

**Purpose**: Add the first trip-oriented checklist workflow. After this slice, a signed-in user can create a packing list for a specific trip or activity, add catalog-backed items or custom checklist entries, and mark entries as packed.

## Depends on

- [Catalog ownership MVP](catalog-ownership-mvp.md)

## Domain additions

- Add `packing_lists` as a user-owned parent record.
- Add `packing_list_entries` as checklist rows that belong to one packing list.
- Each `packing_list_entries` row must store exactly one source:
  - `equipmentItemId` for a catalog-backed entry; or
  - `customName` for a user-defined entry.
- Store `isPacked` on the entry row.
- Inventory remains catalog-backed only. Custom entries are allowed only inside packing lists.

## Screens and routes

### `/packing-lists`

- List the current user's packing lists.
- Allow creating a new packing list with only a name.
- Allow deleting an existing packing list from the list screen.
- Keep the screen focused on list management; do not add templates, sharing, or trip metadata beyond the name.

### `/packing-lists/[id]`

- Show the selected packing list and its current entries.
- Allow adding a custom entry directly on the page.
- Allow toggling `isPacked`.
- Allow deleting existing entries.
- Allow renaming the packing list in place or through a minimal edit control.

### `/catalog/[id]`

- Add a minimal "Add to packing list" action for catalog-backed items.
- Let the user choose one of their existing packing lists as the target.
- Do not add packing-list actions to the `/catalog` browse table in this iteration.

### `/`

- Stop using `/` as a placeholder dashboard after this slice.
- Redirect `/` to `/packing-lists`.

## API contract

### `GET /api/user/packing-lists`

- Return the current user's packing lists with only the fields needed for the list screen.

### `POST /api/user/packing-lists`

- Create a packing list with `{ name }`.

### `PATCH /api/user/packing-lists/[id]`

- Support renaming a packing list owned by the current user.

### `DELETE /api/user/packing-lists/[id]`

- Delete one packing list owned by the current user and its entries.

### `GET /api/user/packing-lists/[id]`

- Return one packing list owned by the current user together with its entries.

### `POST /api/user/packing-lists/[id]/entries`

- Accept either `{ equipmentItemId }` or `{ customName }`.
- Reject requests that provide both fields or neither field.
- For catalog-backed entries, accept only approved items.

### `PATCH /api/user/packing-lists/[id]/entries/[entryId]`

- Support toggling `isPacked`.

### `DELETE /api/user/packing-lists/[id]/entries/[entryId]`

- Delete one entry scoped to the current user's packing list.

## Implementation rules

- Keep packing list metadata minimal in v1: name only.
- Do not add quantities, notes, weight totals, sharing, collaboration, or templates.
- Do not let custom entries leak into user inventory or public catalog flows.
- Use the packing list detail page for custom entry management and the catalog item detail page for adding catalog-backed entries.

## Acceptance

- A signed-in user can create and rename a packing list.
- A signed-in user can add a catalog-backed item to an existing packing list from `/catalog/[id]`.
- A signed-in user can add a custom entry directly on `/packing-lists/[id]`.
- A signed-in user can toggle entries as packed and remove them.
- A signed-in user can delete a packing list.
- The flow remains useful even when the public catalog is incomplete.
