# Catalog ownership MVP

**Purpose**: Turn the shipped catalog browse flow into the first complete end-user loop. After this slice, a signed-in user can open an item detail page, mark that they own the item, and manage that ownership from a dedicated inventory screen.

## Depends on

- The shipped `/catalog` browse flow and existing item read endpoints

## Scope

- Add the first item detail page at `/catalog/[id]`.
- Keep the detail page read-heavy, but include ownership actions in the same iteration.
- Add `/inventory` as the first user-owned management screen.
- Implement `GET /api/user/equipment`, `POST /api/user/equipment`, and `DELETE /api/user/equipment/[id]` as part of the same vertical slice.
- Do not create a separate read-only detail iteration.

## Screens and API

### `/catalog/[id]`

- Fetch `GET /api/equipment/items/[id]`.
- Render item name, brand, category, status, and normalized property values from the existing detail payload.
- Resolve current ownership by reusing `GET /api/user/equipment` and matching rows by item id.
- Show an "I have this" action when the item is not in the current user's inventory.
- Show a remove action when the item is already owned. Use the matched inventory row id for deletion.
- Keep list-to-detail and detail-to-list navigation minimal and concrete.

### `/inventory`

- Fetch `GET /api/user/equipment`.
- Render the existing minimal summary payload only: inventory row id, item summary, and `createdAt`.
- Allow removing a row with `DELETE /api/user/equipment/[id]`.
- Do not add notes, quantities, or custom user metadata.

### `GET /api/user/equipment`

- Return only the current user's inventory rows.
- Keep the payload minimal: inventory row id, item id, item name, brand, category, and `createdAt`.
- Return rows in a stable order suitable for direct rendering.

### `POST /api/user/equipment`

- Accept one approved catalog item id.
- Reject duplicate ownership with `409 Conflict`.
- Reject non-approved items.
- Return the created row in the same shape used by `GET /api/user/equipment`.

### `DELETE /api/user/equipment/[id]`

- Delete by inventory row id scoped to the current user.
- Return `404` when the row does not exist for that user.

## Implementation rules

- Do not add a dedicated ownership-status endpoint in this iteration.
- Reuse the existing item detail payload as the upper bound for `/catalog/[id]`.
- Keep ownership actions off the `/catalog` list page in this slice.
- Prefer explicit loading and refresh states over optimistic UI unless failure recovery is fully clean.

## Acceptance

- A signed-in user can navigate from `/catalog` to `/catalog/[id]`.
- The detail page renders without backend changes to `GET /api/equipment/items/[id]`.
- The same user can add an approved item to inventory from the detail page.
- The item then appears on `/inventory`.
- The same user can remove that inventory row from the detail page or inventory page.
- The slice ships one complete flow from public catalog to personal inventory without adding non-essential catalog or admin work.
