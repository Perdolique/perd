# Brands CRUD

**Purpose**: Simplest admin write flow — single-table CRUD on `brands`. Establishes the pattern for all reference data management and contribution logging.

## Endpoints

- `POST /api/equipment/brands` — create brand. Body: `{ name, slug }`. Log `create_brand` to contributions.
- `PATCH /api/equipment/brands/[id]` — update brand name/slug by stable brand ID. Log `update_brand` to contributions.
- `DELETE /api/equipment/brands/[id]` — delete brand by stable brand ID. Cascades to items via FK. Log `delete_brand` to contributions.
- Public read detail stays on `GET /api/equipment/brands/[slug]`.

## Files to create

- `server/api/equipment/brands/index.post.ts`
- `server/api/equipment/brands/[id].patch.ts`
- `server/api/equipment/brands/[id].delete.ts`

## Depends on

- [01-foundations](01-foundations.md) — validation and contribution logging patterns.
