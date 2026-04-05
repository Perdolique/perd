# Admin catalog management API

**Purpose**: Admins need CRUD operations to populate and maintain the equipment catalog. This is the only way to manage catalog data in MVP (no user submissions). Every write operation must log to `contributions` table for future gamification — this is cheap (one insert) and avoids retroactive data recovery later. All endpoints use `validateAdminUser(event)` from `server/utils/admin.ts` which returns 401 if not logged in, 403 if not admin. All external request inputs are validated with Valibot schemas through h3 validated helpers: `readValidatedBody` for bodies, `getValidatedRouterParams` for route params, and `getValidatedQuery` for query strings. Database writes that need transactions (e.g. creating an item with property values + contribution log) should use the WebSocket client; simple single-table writes can use the HTTP client.

## Route policy

Public read routes for reference data use `slug` in detail URLs. Admin mutation routes for the same reference data use stable `id` route params for `PATCH` and `DELETE`, because `slug` is editable content.

## Tasks

Ordered by execution sequence (simple single-table writes first, complex multi-table transactions last):

1. [Foundations](admin-management/01-foundations.md) — shared patterns for all admin endpoints
1. [Brands CRUD](admin-management/02-brands.md) — create, update, delete brands
1. [Groups CRUD](admin-management/03-groups.md) — create, update, delete groups
1. [Categories CRUD](admin-management/04-categories.md) — create, update, delete categories
1. [Category properties](admin-management/05-category-properties.md) — manage property definitions and enum options
1. [Item creation](admin-management/06-items-create.md) — create items with property values (multi-table transaction)
1. [Item maintenance](admin-management/07-items-maintenance.md) — update and delete items

## Validation

Use Valibot schemas in `server/utils/validation/schemas.ts`. Add new schemas for each entity creation/update and any route/query input the current endpoint accepts. Validate with h3 helpers (`readValidatedBody`, `getValidatedRouterParams`, `getValidatedQuery`) — they throw 400 automatically on validation failure with structured error details.

## Contribution logging

Every write operation inserts a row into `contributions`:

```json
{
  "userId": "<admin-uuid>",
  "action": "create_item",
  "targetId": "0195f6e8-8f44-74f6-bc9a-5c8f7df477d7",
  "metadata": { "name": "NeoAir XLite NXT Regular", "brandId": 1, "categoryId": 1 }
}
```

`targetId` always stores the changed entity primary key as a string. Use a decimal string for `serial` IDs and a canonical UUID string for UUID-based entities.

Actions: `create_item`, `update_item`, `delete_item`, `create_brand`, `update_brand`, `delete_brand`, `create_group`, `update_group`, `delete_group`, `create_category`, `update_category`, `delete_category`.
