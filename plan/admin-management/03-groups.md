# Groups CRUD

**Purpose**: Same complexity as brands — single-table CRUD on `equipment_groups`. No FK to categories (groups and categories are independent).

## Endpoints

- `POST /api/equipment/groups` — create group. Body: `{ name, slug }`. Log `create_group` to contributions.
- `PATCH /api/equipment/groups/[id]` — update group name/slug by stable group ID. Log `update_group` to contributions.
- `DELETE /api/equipment/groups/[id]` — delete group by stable group ID. Log `delete_group` to contributions.

## Files to create

- `server/api/equipment/groups/index.post.ts`
- `server/api/equipment/groups/[id].patch.ts`
- `server/api/equipment/groups/[id].delete.ts`

## Depends on

- [01-foundations](01-foundations.md) — validation and contribution logging patterns.
