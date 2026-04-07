# Category properties and enum options

**Purpose**: Add the smallest admin-only API slice that lets categories define usable item properties before item creation is implemented. This iteration covers creating and deleting property definitions plus enum options, while keeping the public category detail response as the read source of truth.

## Summary

- Add nested admin routes under categories for property and enum option management.
- Keep this iteration backend-only and skip `PATCH` for both properties and enum options.
- Reuse the existing public `GET /api/equipment/categories/[slug]` response shape so new properties appear there automatically after writes.

## Endpoints

### `POST /api/equipment/categories/[categoryId]/properties`

Create a property definition for a category.

Request body:

```json
{
  "name": "Fill Type",
  "slug": "fill-type",
  "dataType": "enum",
  "enumOptions": [
    { "name": "Down", "slug": "down" },
    { "name": "Synthetic", "slug": "synthetic" }
  ]
}
```

Rules:

- `categoryId` is the stable numeric category id.
- `dataType` must be one of `number`, `text`, `boolean`, `enum`.
- `unit` is optional and allowed only for `number` properties.
- `enumOptions` is required for `enum` properties and must contain at least one option.
- `enumOptions` is forbidden for non-`enum` properties.
- `slug` must be unique within the category.
- `enumOptions.slug` must be unique within the request payload and within the property.

Response:

- Return `201` with the created property in the same shape used by category detail reads.
- Non-enum properties return `{ id, name, slug, dataType, unit }`.
- Enum properties additionally return `enumOptions`.

Log contribution action: `create_category_property`.

### `DELETE /api/equipment/categories/[categoryId]/properties/[propertyId]`

Delete a property definition that belongs to the category.

Rules:

- Return `404` if the property does not exist or does not belong to the `categoryId` in the route.
- Deleting the property is intentionally destructive and relies on the existing FK cascade to remove matching `item_property_values`.

Response:

- Return `204` with no body.

Log contribution action: `delete_category_property`.

### `POST /api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options`

Create a single enum option for an existing enum property.

Request body:

```json
{
  "name": "Quilt",
  "slug": "quilt"
}
```

Rules:

- Return `404` if the property does not exist or does not belong to the `categoryId` in the route.
- Return `400` if the target property `dataType` is not `enum`.
- `slug` must be unique within the property.

Response:

- Return `201` with `{ id, name, slug }`.

Log contribution action: `create_property_enum_option`.

### `DELETE /api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId]`

Delete a single enum option from an enum property.

Rules:

- Return `404` if the option does not exist or does not belong to the nested route parents.
- Before deleting, check `item_property_values` for rows where `propertyId` matches and `valueText` equals the option slug.
- Return `409 Conflict` if the option is already used by an item value.

Response:

- Return `204` with no body.

Log contribution action: `delete_property_enum_option`.

## Implementation notes

- Use nested routes rather than standalone property endpoints so route ownership is explicit and the API surface stays small.
- Use `validateAdminUser(event)` for all handlers.
- Validate route params with `getValidatedRouterParams` and request bodies with `readValidatedBody`.
- Use the transaction-capable write path for every mutation because each successful write also inserts into `contributions`.
- Verify parent-child ownership in handlers instead of trusting route params:
  - property belongs to category
  - enum option belongs to property
- Keep public read handlers unchanged. This iteration only adds admin mutations.
- Do not add database migrations. The current schema already supports this slice.

## Validation additions

Add shared runtime limits to `shared/constants.ts` and reuse them in validation:

- `maxCategoryPropertyNameLength = 64`
- `maxCategoryPropertySlugLength = 128`
- `maxCategoryPropertyUnitLength = 16`
- `maxPropertyEnumOptionNameLength = 64`
- `maxPropertyEnumOptionSlugLength = 128`

Add matching Valibot schemas in `server/utils/validation/schemas.ts` for:

- nested category/property/option id params
- property creation body
- enum option creation body

## Files to create

- `server/api/equipment/categories/[categoryId]/properties/index.post.ts`
- `server/api/equipment/categories/[categoryId]/properties/[propertyId].delete.ts`
- `server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/index.post.ts`
- `server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId].delete.ts`
- matching Vitest handler tests under `server/api/equipment/categories/__tests__/`

## Test plan

- Add DB-free Vitest coverage for each new handler following the existing admin endpoint pattern.
- Cover `401`, `403`, `400`, `404`, success, and unexpected `500` paths.
- For property creation, cover:
  - successful `number` property with `unit`
  - successful `enum` property with inline `enumOptions`
  - invalid `unit` on non-`number`
  - missing `enumOptions` for `enum`
  - forbidden `enumOptions` for non-`enum`
  - duplicate property slug within a category
- For enum option creation, cover:
  - successful create on enum property
  - `400` when property is not `enum`
  - duplicate option slug within the property
- For enum option delete, cover:
  - successful delete
  - `409` when the option is already referenced by an item property value
- Keep the existing regression expectation that `GET /api/equipment/categories/[slug]` includes `enumOptions` only for `enum` properties.

## Depends on

- [04-categories](04-categories.md) — categories must exist before properties can be managed.
