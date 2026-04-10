# Admin item maintenance UI

**Purpose**: Give admins the minimum interface to correct or remove catalog items after creation is live. Keep the flow narrowly aligned with the maintenance API instead of expanding into a full admin dashboard.

## Depends on

- [Admin item creation UI](plan/admin-item-create-ui.md)
- [Admin item maintenance API](plan/admin-item-maintenance-api.md)

## Screen

### `/admin/items/[id]/edit`

Admin-only item edit screen.

- Load the existing item from `GET /api/equipment/items/[id]`.
- Load brands from `GET /api/equipment/brands`.
- Load categories from `GET /api/equipment/categories`.
- Load category property definitions from `GET /api/equipment/categories/[slug]` for the current or newly selected category.
- Submit edits through `PATCH /api/equipment/items/[id]`.

## Actions

- Allow editing item name, brand, category, and property values.
- Allow deleting the item from the same screen through `DELETE /api/equipment/items/[id]`.
- Require an explicit confirmation step before delete.

## UI rules

- Reuse the item creation form structure where it stays concrete and readable.
- When category changes, rebuild the dynamic property section from the new category definition instead of attempting cross-category value migration.
- Do not add admin list management for brands, groups, categories, or properties in this iteration.

## Acceptance

- An admin can open the edit page for an existing item, change its values, and save successfully.
- An admin can delete an existing item and the item no longer appears in the public item list or user inventory.
