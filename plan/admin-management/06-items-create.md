# Item creation

**Purpose**: Create equipment items with property values. This is the first multi-table write in the admin API — it inserts into `equipment_items`, bulk-inserts into `item_property_values`, and logs to `contributions`, all within a single transaction.

## Endpoint

- `POST /api/equipment/items` — create item. Body: `{ name, categoryId, brandId, properties: [{ propertyId, value }] }`. Auto-sets `status: 'approved'` and `createdBy` from session. Log `create_item` to contributions.

## Implementation notes

- Use the WebSocket client with a transaction since this is a multi-table write.
- Validate that `categoryId` and `brandId` exist before inserting.
- Validate that each `propertyId` belongs to the given category.
- Map property values to the correct column (`valueText`, `valueNumber`, `valueBoolean`) based on the property's `dataType`.

## Files to create

- `server/api/equipment/items/index.post.ts`

## Depends on

- [05-category-properties](05-category-properties.md) — categories must have property definitions before items can reference them.
- [02-brands](02-brands.md) — brands must exist before items can reference them.
