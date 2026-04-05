# Categories CRUD

**Purpose**: Basic CRUD on `equipment_categories` — create, rename, delete categories. Does NOT include managing category properties (that is a separate task). Deleting a category cascades to its properties, items, and property values via FK.

## Endpoints

- `POST /api/equipment/categories` — create category. Body: `{ name, slug }`. Log `create_category` to contributions.
- `PATCH /api/equipment/categories/[id]` — update category name/slug by stable category ID. Log `update_category` to contributions.
- `DELETE /api/equipment/categories/[id]` — delete category by stable category ID. Cascades to properties, items, and property values. Log `delete_category` to contributions.
- Public read detail stays on `GET /api/equipment/categories/[slug]`.

## Files to create

- `server/api/equipment/categories/index.post.ts`
- `server/api/equipment/categories/[id].patch.ts`
- `server/api/equipment/categories/[id].delete.ts`

## Depends on

- [01-foundations](01-foundations.md) — validation and contribution logging patterns.
