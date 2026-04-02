# Categories CRUD

**Purpose**: Basic CRUD on `equipment_categories` — create, rename, delete categories. Does NOT include managing category properties (that is a separate task). Deleting a category cascades to its properties, items, and property values via FK.

## Endpoints

- `POST /api/equipment/categories` — create category. Body: `{ name, slug }`. Log `create_category` to contributions.
- `PATCH /api/equipment/categories/[slug]` — update category name/slug. Log `update_category` to contributions.
- `DELETE /api/equipment/categories/[slug]` — delete category. Cascades to properties, items, property values. Log `delete_category` to contributions.

## Files to create

- `server/api/equipment/categories/index.post.ts`
- `server/api/equipment/categories/[slug].patch.ts`
- `server/api/equipment/categories/[slug].delete.ts`

## Depends on

- [01-foundations](01-foundations.md) — validation and contribution logging patterns.
