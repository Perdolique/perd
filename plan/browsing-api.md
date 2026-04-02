# Equipment browsing API

**Purpose**: These are the read-only endpoints that power the equipment catalog UI. Users need to browse groups, categories, items, and brands to find gear and add it to their inventory. All endpoints require authentication (existing `server/middleware/api-session-check.ts` blocks unauthenticated `/api/*` requests). Database access uses the HTTP client via `event.context.dbHttp`. Follow the handler pattern from `server/api/account/index.delete.ts` (imports from `#server/...`, `defineEventHandler`, Drizzle query).

## Endpoints

### `GET /api/equipment/groups`

**Purpose**: Powers the top-level navigation. The frontend will show groups as the entry point for browsing equipment (e.g. "Sleep", "Shelter", "Cooking"). Simple select-all query on `equipment_groups` table, no joins needed.

Response:

```json
[
  { "id": 1, "name": "Sleep", "slug": "sleep" },
  { "id": 2, "name": "Shelter", "slug": "shelter" }
]
```

### `GET /api/equipment/categories`

**Purpose**: Returns flat list of all categories. Used for category selection dropdowns and navigation. Groups and categories have no FK relationship, so there's no filtering by group — they're independent entities. Simple select-all on `equipment_categories`.

Response:

```json
[
  { "id": 1, "name": "Sleeping Bags", "slug": "sleeping-bags" },
  { "id": 2, "name": "Sleeping Pads", "slug": "sleeping-pads" }
]
```

### `GET /api/equipment/categories/[slug]`

**Purpose**: When a user clicks on a category, show the category info plus its property definitions. This data tells the frontend what filter controls to render (number inputs for "Weight", dropdowns for enum "Fill Type", etc.). Properties with `dataType: 'enum'` must include their `enumOptions`. Requires a join: `equipment_categories` → `category_properties` → `property_enum_options`.

Response:

```json
{
  "id": 1,
  "name": "Sleeping Bags",
  "slug": "sleeping-bags",
  "properties": [
    { "id": 1, "name": "Temperature Rating", "slug": "temperature-rating", "dataType": "number", "unit": "°C" },
    { "id": 2, "name": "Fill Type", "slug": "fill-type", "dataType": "enum", "unit": null, "enumOptions": [
      { "id": 1, "name": "Down", "slug": "down" },
      { "id": 2, "name": "Synthetic", "slug": "synthetic" }
    ]}
  ]
}
```

### `GET /api/equipment/items`

**Purpose**: The main item search/list endpoint. Users browse items filtered by category, brand, or text search. This is the core of the catalog browsing experience. Only return `status = 'approved'` items (future user submissions may have `pending` status). Needs pagination because the catalog will grow. Joins `equipment_items` with `brands` and `equipment_categories` to return denormalized data. Text search uses simple ILIKE on item name (no `pg_trgm` or fuzzy search for MVP).

Query params:

- `categorySlug` — filter by category (join `equipment_categories` on slug)
- `brandSlug` — filter by brand (join `brands` on slug)
- `search` — ILIKE text search on item name
- `page`, `limit` — pagination (default: page=1, limit=20)

Response:

```json
{
  "items": [
    {
      "id": "01234567-...",
      "name": "NeoAir XLite NXT Regular",
      "brand": { "name": "Therm-a-Rest", "slug": "therm-a-rest" },
      "category": { "name": "Sleeping Pads", "slug": "sleeping-pads" }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### `GET /api/equipment/items/[id]`

**Purpose**: Item detail page. When a user clicks on an item, show everything: name, brand, category, and all EAV property values. This is where the EAV pattern pays off — properties are dynamic per category, so the response shape varies. Requires joining `equipment_items` → `brands`, `equipment_categories`, `item_property_values` → `category_properties`. The `id` param is a UUID v7.

Response:

```json
{
  "id": "01234567-...",
  "name": "NeoAir XLite NXT Regular",
  "status": "approved",
  "brand": { "id": 1, "name": "Therm-a-Rest", "slug": "therm-a-rest" },
  "category": { "id": 1, "name": "Sleeping Pads", "slug": "sleeping-pads" },
  "properties": [
    { "name": "R-Value", "slug": "r-value", "dataType": "number", "unit": null, "value": "4.2" },
    { "name": "Weight", "slug": "weight", "dataType": "number", "unit": "g", "value": "340" },
    { "name": "Type", "slug": "type", "dataType": "enum", "unit": null, "value": "inflatable" }
  ],
  "createdAt": "2026-04-01T00:00:00Z"
}
```

### `GET /api/equipment/brands`

**Purpose**: Brand listing for brand navigation or brand filter dropdown. Optional text search so users can quickly find a brand by name. Simple select on `brands` table with optional ILIKE filter.

Query params:

- `search` — ILIKE text search on brand name

Response:

```json
[
  { "id": 1, "name": "Therm-a-Rest", "slug": "therm-a-rest" },
  { "id": 2, "name": "Nemo", "slug": "nemo" }
]
```

### `GET /api/equipment/brands/[slug]`

**Purpose**: Brand detail page. Shows brand info and all approved items from that brand. Users might want to browse by brand ("show me all Therm-a-Rest gear"). Join `brands` → `equipment_items` (where status = 'approved') → `equipment_categories`.

Response:

```json
{
  "id": 1,
  "name": "Therm-a-Rest",
  "slug": "therm-a-rest",
  "items": [
    { "id": "01234567-...", "name": "NeoAir XLite NXT Regular", "category": { "name": "Sleeping Pads", "slug": "sleeping-pads" } }
  ]
}
```

## Files to create

- `server/api/equipment/groups/index.get.ts`
- `server/api/equipment/categories/index.get.ts`
- `server/api/equipment/categories/[slug].get.ts`
- `server/api/equipment/items/index.get.ts`
- `server/api/equipment/items/[id].get.ts`
- `server/api/equipment/brands/index.get.ts`
- `server/api/equipment/brands/[slug].get.ts`
