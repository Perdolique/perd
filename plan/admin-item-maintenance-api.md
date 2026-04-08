# Admin item maintenance API

**Purpose**: Support the minimum edit and delete flows for catalog items after creation exists. This iteration should match the UI flow directly instead of inventing a generic patch protocol.

## Endpoints

### `PATCH /api/equipment/items/[id]`

Update one existing item.

Request body:

```json
{
  "name": "NeoAir XLite NXT Max",
  "brandId": 1,
  "categoryId": 2,
  "properties": [
    { "propertyId": 21, "value": 540 },
    { "propertyId": 22, "value": "self-inflating" }
  ]
}
```

Behavior:

- Treat every field as optional at the top level.
- When `properties` is present, treat it as the full replacement set for the selected category.
- If `categoryId` changes, validate the replacement properties against the new category.
- Write contribution metadata as a compact diff covering changed top-level fields and changed property values.

### `DELETE /api/equipment/items/[id]`

Delete one item by UUID.

- Delete by primary key.
- Rely on the existing FK cascades to remove linked `item_property_values` and `user_equipment` rows.
- Log `delete_item` to `contributions`.

## Validation and behavior

- Use `validateAdminUser(event)`.
- Validate the item id as a UUID v7.
- Return `404` when the item does not exist.
- For `PATCH`, validate referenced brands, categories, and property ownership exactly as in item creation.
- Use a transaction whenever the operation touches both the item row and property value rows.

## Files to create

- `server/api/equipment/items/[id].patch.ts`
- `server/api/equipment/items/[id].delete.ts`

## Test plan

- Add DB-free Vitest coverage for `401`, `403`, `400`, `404`, success, and unexpected `500`.
- Cover top-level field-only update.
- Cover property replacement update.
- Cover category change with replacement properties.
- Cover delete success and contribution logging.
