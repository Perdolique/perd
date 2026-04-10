# Technical debt

Accepted follow-up work that is intentionally deferred after a smaller safe iteration ships.

## API error mapping

- **Map restricted brand/category deletes to `409 Conflict`** — deleting a brand or category that is still referenced by `equipment_items` is now blocked by DB `RESTRICT` FKs, but `server/api/equipment/brands/[id].delete.ts` and `server/api/equipment/categories/[id].delete.ts` still turn that database error into a generic `500`. Catch the FK violation and return a domain error like `409 Conflict` with a clear "in use" message.

## Shared length limits

- **Finish replacing remaining hardcoded schema lengths with shared `limits`** — `shared/constants.ts` is already the source of truth for runtime validation and part of the Drizzle schema, but some `varchar({ length: ... })` values in `server/database/schema.ts` are still hardcoded. Replace the remaining literals with the same shared `limits` values so request validation and DB constraints cannot silently drift.

## OAuth user creation tests

- **Add unit tests for `createOAuthUser`** — `server/utils/oauth/account.ts` now contains non-trivial transaction and error-handling logic, but it has no direct unit coverage. Add focused Vitest tests for the success path that creates the user and OAuth link, the `404` path when the provider is missing, the `500` path when user creation fails or an unexpected error is thrown, and the cleanup path that always closes the DB client in `finally`.

## Browsing API refinement

- **Refine category detail loading** — in `GET /api/equipment/categories/[slug]`, fetch enum options only for enum properties instead of loading relation data that is later discarded for non-enum properties.

## Handler coverage expansion

- **Expand DB-free Vitest handler coverage** — the current catalog handlers already use the baseline pattern: direct handler imports plus mocked `event`, `dbHttp`, and auth/body helpers. Extend the same approach to the remaining API endpoints as they stabilize.
