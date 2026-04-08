# Admin item creation API

**Purpose**: Create catalog items with their initial property values. This is the first remaining admin item write and the first multi-table admin operation that must be implemented end-to-end around items.

## Endpoint

### `POST /api/equipment/items`

Create one approved catalog item.

Request body:

```json
{
  "name": "NeoAir XLite NXT Regular",
  "categoryId": 1,
  "brandId": 1,
  "properties": [
    { "propertyId": 10, "value": 340 },
    { "propertyId": 11, "value": "inflatable" }
  ]
}
```

Behavior:

- Auto-set `status: 'approved'`.
- Auto-set `createdBy` from the current admin session.
- Insert the item, its property values, and the contribution log row in one transaction.
- Log `create_item` with metadata `{ name, brandId, categoryId }`.

## Validation

- Require `name`, `categoryId`, `brandId`, and `properties`.
- Validate that the target category and brand exist.
- Validate that each `propertyId` belongs to the selected category.
- Validate that each property appears at most once in the request.
- Map the provided value into the correct storage column based on the property's `dataType`:
  - `text` and `enum` -> `valueText`
  - `number` -> `valueNumber`
  - `boolean` -> `valueBoolean`
- For enum properties, validate the submitted option slug against `property_enum_options`.

## Implementation rules

- Use `validateAdminUser(event)`.
- Add request validation through `server/utils/validation/schemas.ts`.
- Use the transaction-capable write path because success requires writes to `equipment_items`, `item_property_values`, and `contributions`.
- Keep the API limited to single-item creation. No bulk create, no custom status, no variant logic.

## Files to create

- `server/api/equipment/items/index.post.ts`

## Test plan

- Add DB-free Vitest coverage for `401`, `403`, `400`, `404`, success, and unexpected `500`.
- Cover invalid category or brand ids.
- Cover property ownership mismatches.
- Cover duplicate `propertyId` entries in one request.
- Cover enum value rejection when the slug is not one of the property's allowed options.
