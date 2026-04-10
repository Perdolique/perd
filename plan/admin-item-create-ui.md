# Admin item creation UI

**Purpose**: Give admins the minimum UI needed to create real catalog items without touching the database directly. This iteration should be just enough to support seed-like manual catalog growth.

## Depends on

- [Admin item creation API](plan/admin-item-create-api.md)

## Screen

### `/admin/items/new`

Admin-only item creation page.

- Load brands from `GET /api/equipment/brands`.
- Load categories from `GET /api/equipment/categories`.
- After category selection, load category properties from `GET /api/equipment/categories/[slug]`.
- Submit the final payload to `POST /api/equipment/items`.

## Form behavior

- Required top-level fields: item name, brand, category.
- Render dynamic property inputs from the selected category definition:
  - text input for `text`
  - numeric input for `number`
  - checkbox for `boolean`
  - select for `enum`
- Build the request body in the API contract shape: `{ name, categoryId, brandId, properties: [{ propertyId, value }] }`.
- Omit untouched optional property rows instead of sending empty values.

## UI rules

- Keep the page admin-only and standalone. Do not bundle brand/category/property management into this screen.
- Do not add draft save, duplication, or bulk entry helpers.
- After success, navigate to the created item detail page if the API returns the item id; otherwise navigate back to the catalog list with a success state.

## Acceptance

- An admin can select a category, fill the generated property fields, submit the form, and create one item successfully.
- The resulting item is visible through the existing public item read endpoints.
