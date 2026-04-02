# Admin item management API

**Purpose**: Admins need CRUD operations to populate and maintain the equipment catalog. This is the only way to manage catalog data in MVP (no user submissions). Every write operation must log to `contributions` table for future gamification — this is cheap (one insert) and avoids retroactive data recovery later. All endpoints use `validateAdminUser(event)` from `server/utils/admin.ts` which returns 401 if not logged in, 403 if not admin. Request bodies are validated with Valibot schemas via `readValidatedBody` from h3 (see `server/api/auth/create-session.post.ts` for pattern). Database writes that need transactions (e.g. creating an item with property values + contribution log) should use the WebSocket client; simple single-table writes can use the HTTP client.

## Endpoints

### Items

- `POST /api/equipment/items` — create item with property values. Body: `{ name, categoryId, brandId, properties: [{ propertyId, value }] }`. Auto-sets `status: 'approved'` and `createdBy` from session. Inserts into `equipment_items`, then bulk-inserts into `item_property_values`, then logs to `contributions`. Use transaction (WebSocket client) since it's multi-table.
- `PATCH /api/equipment/items/[id]` — update item fields and/or property values. Partial update. Log to `contributions` with diff in metadata.
- `DELETE /api/equipment/items/[id]` — delete item (cascades to property values and user_equipment via FK). Log to `contributions`.

### Brands

- `POST /api/equipment/brands` — create brand. Body: `{ name, slug }`. Log to `contributions`.
- `PATCH /api/equipment/brands/[slug]` — update brand name/slug. Log to `contributions`.
- `DELETE /api/equipment/brands/[slug]` — delete brand. Cascades to items via FK. Log to `contributions`.

### Groups

- `POST /api/equipment/groups` — create group. Body: `{ name, slug }`. Log to `contributions`.
- `PATCH /api/equipment/groups/[slug]` — update group name/slug. Log to `contributions`.
- `DELETE /api/equipment/groups/[slug]` — delete group. Log to `contributions`.

### Categories

- `POST /api/equipment/categories` — create category. Body: `{ name, slug }`. Log to `contributions`.
- `PATCH /api/equipment/categories/[slug]` — update category name/slug and/or property definitions. Log to `contributions`.
- `DELETE /api/equipment/categories/[slug]` — delete category. Cascades to properties, items, property values via FK. Log to `contributions`.

## Validation

**Purpose**: Prevent invalid data from entering the catalog. Use Valibot schemas in `server/utils/validation/schemas.ts`. Add new schemas for each entity creation/update. Validate with `readValidatedBody` from h3 — it throws 400 automatically on validation failure with structured error details.

## Contribution logging

**Purpose**: Every catalog mutation gets logged so we can build gamification/reputation later without losing historical data. The `contributions` table stores who did what, to which entity, and optionally what changed.

Every write operation inserts a row into `contributions`:

```json
{
  "userId": "<admin-uuid>",
  "action": "create_item",
  "targetId": "<item-uuid>",
  "metadata": { "name": "NeoAir XLite NXT Regular", "brandId": 1, "categoryId": 1 }
}
```

Actions: `create_item`, `update_item`, `delete_item`, `create_brand`, `update_brand`, `delete_brand`, `create_group`, `update_group`, `delete_group`, `create_category`, `update_category`, `delete_category`.

## Files to create

- `server/api/equipment/items/index.post.ts`
- `server/api/equipment/items/[id].patch.ts`
- `server/api/equipment/items/[id].delete.ts`
- `server/api/equipment/brands/index.post.ts`
- `server/api/equipment/brands/[slug].patch.ts`
- `server/api/equipment/brands/[slug].delete.ts`
- `server/api/equipment/groups/index.post.ts`
- `server/api/equipment/groups/[slug].patch.ts`
- `server/api/equipment/groups/[slug].delete.ts`
- `server/api/equipment/categories/index.post.ts`
- `server/api/equipment/categories/[slug].patch.ts`
- `server/api/equipment/categories/[slug].delete.ts`
