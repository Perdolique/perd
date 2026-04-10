# Admin item management overview

**Purpose**: Reference-data admin management is already shipped. The remaining admin roadmap covers the catalog item lifecycle: creating items, then editing and deleting them, and finally exposing those flows through minimal admin screens. Every write operation continues to log to `contributions`.

## Completed baseline

- Admin CRUD for brands, groups, and categories is implemented.
- Category property and enum option management is implemented under nested category routes.
- Public reference-data reads use `slug`, while admin mutations use stable `id` params.
- Brand and category deletes are blocked by `equipment_items` foreign keys with `onDelete: 'restrict'`; cleanup cannot silently remove existing items.
- Nested category-property delete handlers use the current Nuxt file layout (`.../[propertyId]/index.delete.ts` and `.../[optionId]/index.delete.ts`), not flat sibling delete files.

## Remaining admin iterations

1. [Admin item creation API](plan/admin-item-create-api.md)
1. [Admin item creation UI](plan/admin-item-create-ui.md)
1. [Admin item maintenance API](plan/admin-item-maintenance-api.md)
1. [Admin item maintenance UI](plan/admin-item-maintenance-ui.md)

## Shared rules

- All admin endpoints use `validateAdminUser(event)` from `server/utils/admin.ts`.
- Validate external inputs through Valibot schemas in `server/utils/validation/schemas.ts` and h3 helpers such as `readValidatedBody`, `getValidatedRouterParams`, and `getValidatedQuery`.
- Use the WebSocket client for transaction-bound writes. Simple single-table writes may use the HTTP client.
- `targetId` in `contributions` is always a stringified primary key: decimal string for `serial` entities and canonical UUID string for UUID entities.

## Contribution actions in use

- `create_brand`
- `update_brand`
- `delete_brand`
- `create_group`
- `update_group`
- `delete_group`
- `create_category`
- `update_category`
- `delete_category`
- `create_category_property`
- `delete_category_property`
- `create_property_enum_option`
- `delete_property_enum_option`
- `create_item`
- `update_item`
- `delete_item`
