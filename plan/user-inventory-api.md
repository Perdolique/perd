# User inventory API

**Purpose**: The core user-facing feature. Users search items in the global catalog (browsing API endpoints) and add them to their personal inventory — "this is what I own/carry". This is the main value prop of the app: hikers and bikepackers track their gear. Authentication is already handled by existing middleware. Use `validateSessionUser(event)` from `server/utils/session.ts` to get userId. Database access via `event.context.dbHttp`.

## Endpoints

### `GET /api/user/equipment`

**Purpose**: Shows the user's gear closet. Returns all items the user has added to their inventory, with enough item detail (name, brand, category) to display a useful list without extra API calls. Join `user_equipment` → `equipment_items` → `brands`, `equipment_categories`. Filter by `userId` from session.

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

**Purpose**: User adds an item to their inventory. Takes just the `itemId` — the user picks an item from the catalog and clicks "I have this". Must check the item actually exists and is `status = 'approved'`. Returns 409 if the user already has this item (unique constraint on `userId + itemId`).

Request body:

```json
{ "itemId": "<item-uuid>" }
```

Returns 201 on success. 409 if already in inventory.

### `DELETE /api/user/equipment/[id]`

**Purpose**: User removes an item from their inventory. The `id` param is the `user_equipment` UUID (not the item UUID), so we delete by PK. Must verify the record belongs to the requesting user (don't let user A delete user B's inventory entry).

Returns 204 on success.

## Files to create

- `server/api/user/equipment/index.get.ts`
- `server/api/user/equipment/index.post.ts`
- `server/api/user/equipment/[id].delete.ts`
