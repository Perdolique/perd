# Brands CRUD

**Purpose**: Simplest admin write flow — single-table CRUD on `brands`. Establishes the pattern for all reference data management and contribution logging.

## Endpoints

- `POST /api/equipment/brands` — create brand. Body: `{ name, slug }`. Log `create_brand` to contributions.
- `PATCH /api/equipment/brands/[slug]` — update brand name/slug. Log `update_brand` to contributions.
- `DELETE /api/equipment/brands/[slug]` — delete brand. Cascades to items via FK. Log `delete_brand` to contributions.

## Files to create

- `server/api/equipment/brands/index.post.ts`
- `server/api/equipment/brands/[slug].patch.ts`
- `server/api/equipment/brands/[slug].delete.ts`

## Depends on

- [01-foundations](01-foundations.md) — validation and contribution logging patterns.
