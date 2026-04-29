# Perd - Outdoor equipment companion

## Technical stack

- Nuxt 4 (with Nuxt 5 compatibility flag enabled)
- Drizzle ORM
- Neon PostgreSQL

## Core project invariants

- Equipment properties use an EAV model: `category_properties` defines available fields, `item_property_values` stores per-item values.
- Groups and categories are separate reference entities with no FK between them. Do not invent one unless the product plan explicitly changes.
- Items are flat. Size and similar distinctions are category properties, not a variant subsystem.
- User-facing catalog entities use UUID v7 where the product already depends on stable public IDs. Reference data uses serial IDs.
- Reference-data slugs are canonical lowercase URL tokens using only `a-z`, `0-9`, and single hyphens.
- Reference-data `name` values stay English display strings. Slugs are the durable keys for URLs and future i18n lookups.
- `equipment_items` brand/category foreign keys must stay non-cascading (`restrict`), so deleting reference data cannot silently remove catalog or inventory records.
- Public reference-data read routes use `slug`; admin mutations use stable `id` params.
- All tables live in `server/database/schema.ts`, organized by Auth, Equipment catalog, and User data sections.

## Visual design prototype

The designer's visual prototype of the final application lives in `new-design-assets/`. It is the source of truth for UI layout, component appearance, color tokens, typography, spacing, and interaction patterns.

When creating or updating Vue components, page layouts, or any visual styles, consult `new-design-assets/` first:

- `new-design-assets/styles/tokens.css` — design tokens (colors, spacing, typography scale).
- `new-design-assets/styles/base.css` and `components.css` — global resets and component-level styles.
- `new-design-assets/scripts/` — JSX view files that show per-screen layout and component structure (`view-dashboard.jsx`, `view-catalog.jsx`, `view-detail.jsx`, etc.).
- `new-design-assets/index.html` — runnable prototype; open in a browser to inspect the full interactive design.

Do not invent visual decisions (colors, spacing values, component shapes) that contradict the prototype. If the prototype does not cover a case, match the nearest existing pattern from it.

## Local skills

Before any task, check whether a local skill matches the domain and follow it.

- `nuxt-app` for Nuxt pages, layouts, app composables, internal API fetch typing, request-aware `useRequestFetch()`, and Nitro handler return types that drive internal route inference.
- `vue-components` for `.vue` component structure, styling, props/emits, and SSR-safe frontend patterns.
- `equipment-backend` for equipment/catalog backend work in `server/api`, validation schemas, Drizzle write paths, schema changes, and equipment API tests.
- `planning-docs` for roadmap files in `plan/`, completed work notes, architecture docs, and iteration planning tasks.

## Workflow rules

- Files imported by standalone Node or `tsx` scripts, including `tools/*.ts`, migrations, seeds, and their transitive dependencies, must not rely on Nuxt-only aliases like `~/` or `@@/`. If they use `#shared/*` or `#server/*`, keep those aliases backed by `package.json#imports`.
- Do not implement fixes, features, compatibility branches, or refactors unless they address a reproducible problem, an explicitly requested behavior, or a currently supported project scenario. Treat hypothetical improvements and broader compatibility ideas as follow-up work, not as justification for changing the current behavior.
- Async action areas must remain structurally stable while state is loading or mutating. Keep the same interactive control mounted and change its state instead of swapping it out for unrelated text blocks.
- Related navigation and actions must be grouped by user meaning. Do not tuck inventory actions or similar workflow controls into unrelated content sections such as property lists.
- Plan each "next iteration" as a sequence of minimal self-contained tasks. Every task must state its intended result, scope boundaries, and required verification.
- When one iteration spans multiple tasks, each task must be safe to complete, commit, and validate independently without hidden follow-up decisions.
- New Playwright scenarios should be run against their individual spec file before the full `pnpm run test:e2e:ci` suite.
- Playwright `context.route(...)` matchers must account for query strings whenever the real endpoint is requested with query parameters.
- E2E flows that rely on mocked auth should not use `page.goto()` after login unless the test also establishes a real server-side session cookie.
- If browser tests run through `wrangler dev`, the E2E preview path must keep Wrangler state, logs, and config under a writable temp directory instead of the user's default `~/.config`.
- After any architecture, route-convention, data-model, or test-strategy change, update the relevant docs in the same change. This can include `AGENTS.md`, `plan/PLAN.md`, `plan/completed.md`, or the detailed roadmap file that changed.

## Verification matrix

After any code modification, run the checks that match the files you touched.

- If Markdown files changed: `pnpm run lint:markdown`
- If TypeScript or Vue code changed: `pnpm run test:typecheck`
- If TypeScript or Vue code changed: `pnpm run test:unit:agent`
- If TypeScript or Vue code changed: `pnpm run lint:oxlint`
- If TypeScript or Vue code changed: `pnpm run build`
- If TypeScript or Vue code changed: `pnpm run test:e2e:ci`

All applicable commands may be run in parallel.
