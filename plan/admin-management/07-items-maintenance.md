# Item maintenance

**Purpose**: Update and delete existing equipment items. Update is the most complex admin operation — it supports partial updates to item fields and/or property values, potentially within a transaction.

## Endpoints

- `PATCH /api/equipment/items/[id]` — update item fields and/or property values. Partial update: only provided fields are changed. Log `update_item` to contributions with diff in metadata. Use transaction if both item fields and property values are updated.
- `DELETE /api/equipment/items/[id]` — delete item. Cascades to property values and user_equipment via FK. Log `delete_item` to contributions.

## Implementation notes

- The `id` param is a UUID v7.
- For PATCH, determine which columns actually changed and store the diff in contribution metadata.
- Delete is straightforward — single delete by PK with cascade.

## Files to create

- `server/api/equipment/items/[id].patch.ts`
- `server/api/equipment/items/[id].delete.ts`

## Depends on

- [06-items-create](06-items-create.md) — items must exist before they can be updated or deleted.
