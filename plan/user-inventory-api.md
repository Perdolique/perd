# User inventory API

**Purpose**: Add the first user-owned data on top of the global catalog. A signed-in user should be able to list the items they own, add an approved item from the catalog, and remove an existing inventory row without affecting anyone else's data.

## Shared rules

- Use `validateSessionUser(event)` from `server/utils/session.ts` to resolve the current `userId`.
- Use the HTTP client unless an implementation detail proves a transaction is necessary.
- Keep the payload minimal: inventory row id, item summary, and `createdAt`.

## Endpoints

### `GET /api/user/equipment`

Return the current user's inventory rows.

- Filter by `userId` from session.
- Join `user_equipment` to `equipment_items`, `brands`, and `equipment_categories`.
- Return only the data needed for the inventory page.

Response:

```json
[
  {
    "id": "<user-equipment-uuid>",
    "item": {
      "id": "<item-uuid>",
      "name": "NeoAir XLite NXT Regular",
      "brand": { "name": "Therm-a-Rest", "slug": "therm-a-rest" },
      "category": { "name": "Sleeping Pads", "slug": "sleeping-pads" }
    },
    "createdAt": "2026-04-01T00:00:00Z"
  }
]
```

### `POST /api/user/equipment`

Add one approved item to the current user's inventory.

Request body:

```json
{ "itemId": "<item-uuid>" }
```

Rules:

- Validate `itemId` as a UUID v7.
- Return `404` if the item does not exist.
- Return `400` or `404` only for domain validation, not duplicate ownership.
- Return `409 Conflict` if the same user already has the item.
- Reject items whose status is not `approved`.

Return `201` with the created inventory row in the same shape used by `GET /api/user/equipment`.

### `DELETE /api/user/equipment/[id]`

Remove one inventory row by `user_equipment.id`.

Rules:

- Validate the route id as a UUID v7.
- Verify that the row belongs to the requesting user before deleting it.
- Return `404` when the row does not exist for that user.

Return `204` on success.

## Files to create

- `server/api/user/equipment/index.get.ts`
- `server/api/user/equipment/index.post.ts`
- `server/api/user/equipment/[id].delete.ts`

## Test plan

- Add DB-free Vitest coverage for `401`, `400`, `404`, `409`, success, and unexpected `500`.
- Cover duplicate add attempts.
- Cover add rejection for non-approved items.
- Cover delete rejection when the inventory row belongs to another user.
