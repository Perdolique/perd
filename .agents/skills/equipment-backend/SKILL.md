---
name: equipment-backend
description: Equipment and catalog backend conventions for the Perd project. Use this skill whenever the task touches `server/api`, `server/utils/validation`, `server/database/schema.ts`, Drizzle write paths, equipment reference data, contributions logging, or equipment API tests, even if the user does not explicitly mention the backend skill.
---

# Equipment Backend Conventions

Use this skill for equipment and catalog backend work. Keep the implementation narrow, predictable, and shaped by current product needs instead of speculative abstractions.

## Scope

Apply these rules when working on:

- `server/api/equipment/**`
- `server/utils/validation/**`
- `server/database/schema.ts`
- Drizzle queries and write paths that touch equipment catalog data
- Equipment-related Vitest API handler tests

Do not use this skill for generic Vue or styling work. Use the dedicated frontend skill for `.vue` files.

## Data model expectations

- Keep the EAV model intact: `category_properties` defines available properties, `item_property_values` stores actual item values.
- Keep groups and categories independent. Do not add a foreign key between them unless the product plan explicitly changes.
- Treat items as flat catalog rows. Size and similar distinctions belong in properties, not a variant system.
- Keep UUID v7 for user-facing entities and serial IDs for reference data.
- Keep reference-data slugs canonical and lowercase.
- Keep `equipment_items` foreign keys to brand/category non-cascading with `restrict`.
- Keep all schema sections in `server/database/schema.ts`.

## Route and validation conventions

- Public read routes for reference data use `slug` in route params.
- Admin mutation routes for reference data use stable `id` params because `slug` is editable content.
- Category-property admin routes stay nested under category ID routes so handlers can verify parent ownership from the route chain.
- Validate every request input through the shared Valibot helpers:
  - `readValidatedBody` for request bodies
  - `getValidatedRouterParams` for route params
  - `getValidatedQuery` for query strings
- Keep schemas and validator helpers in `server/utils/validation/schemas.ts`. Handlers should consume parsed values, not manually re-validate raw input.

## Write-path and query-shape rules

- Any admin catalog write that both mutates reference data and logs `contributions` must be atomic. Use a transaction-capable write path rather than separate `dbHttp` calls.
- `contributions.targetId` stores the changed entity primary key as a string so it can hold either serial IDs or UUIDs.
- Public detail endpoints stay narrow. Return the entity needed for that route and fetch related collections with separate endpoints only when there is a concrete consumer.
- For shared `returning(...)` fragments, prefer small server-only base-record helpers over global endpoint models.
- When only one row is needed once, destructure directly from the awaited query result: `const [row] = await ...`.
- If deleting an enum option would orphan existing enum item values, return `409`.
- Protected `/api/*` routes keep mixed unauthenticated behavior: browser navigations redirect to login, programmatic requests still receive `401`.

## Testing expectations

- Cover API handlers in Vitest with mocks for `event`, `dbHttp`, auth helpers, and validated-input helpers as needed.
- Do not rely on seeded database state or fixed catalog row counts in required tests.
- Keep browser-level coverage in Playwright as smoke coverage, not the primary API contract layer.
- Put shared test helpers in the repo root, such as `test-utils/`, instead of runtime source trees.
- Prefer `vi.mock(import(...))` so mocks stay aligned with the project lint rules.
- Avoid file-level lint disables in tests unless there is a documented tool mismatch and no cleaner local fix.

## Skill maintenance

If this skill starts to sprawl, move detailed reference material into `references/` files instead of bloating this `SKILL.md`.
