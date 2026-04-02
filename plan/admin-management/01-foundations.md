# Admin foundations

**Purpose**: Establish shared patterns before implementing any admin CRUD endpoint. This is not code to write — it is conventions to follow in all subsequent admin tasks.

## Conventions

- All admin endpoints use `validateAdminUser(event)` from `server/utils/admin.ts`. Returns userId on success, throws 401/403 on failure.
- Request body validation uses Valibot schemas via `readValidatedBody` from h3. Schemas live in `server/utils/validation/schemas.ts`.
- Every mutation inserts a row into `contributions` with `userId`, `action`, `targetId`, and optional `metadata`. `targetId` is always a stringified primary key: decimal string for `serial` entities, canonical UUID string for UUID entities. See [admin overview](../admin-api.md) for action names and payload format.
- Simple single-table writes use the HTTP client (`event.context.dbHttp`). Multi-table writes that must be atomic use the WebSocket client with a transaction.
- Handler pattern follows `server/api/account/index.delete.ts`: imports from `#server/...`, `defineEventHandler`, Drizzle query builder.

## Files to create

- Add Valibot schemas for brands, groups, categories, items to `server/utils/validation/schemas.ts` (incrementally, per task).

## Depends on

Nothing — this is the first task in the admin management iteration.
