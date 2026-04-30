# Agents instructions

## Always-on context

- Perd is an outdoor equipment companion centered on catalog browsing, personal inventory, and packing workflows.
- Keep this file lean: use it for non-obvious project guardrails, and load the matching local skill for domain procedures instead of duplicating them here.

## Product guardrails

- Keep equipment properties in the EAV model: `category_properties` defines available fields, and `item_property_values` stores per-item values.
- Keep groups and categories independent. Do not add a foreign key between them unless the product plan explicitly changes.
- Keep catalog items flat. Size and similar distinctions belong in category properties, not a variant subsystem.
- Keep reference-data slugs as canonical lowercase URL tokens using only `a-z`, `0-9`, and single hyphens; `name` values stay English display strings.
- Keep `equipment_items` brand/category foreign keys non-cascading (`restrict`) so reference-data deletion cannot silently remove catalog or inventory records.

## Frontend and UX guardrails

- For UI work, `new-design-assets/` is the source of truth for layout, component appearance, color tokens, typography, spacing, and interaction patterns.
- Consult the prototype before changing Vue components, page layouts, or visual styles; match the nearest existing prototype pattern when a case is not covered exactly.
- Keep async action areas structurally stable while loading or mutating. Keep the same interactive control mounted and change its state instead of swapping it for unrelated text.
- Group navigation and actions by user meaning. Do not tuck inventory actions or similar workflow controls into unrelated content sections such as property lists.

## Workflow guardrails

- Files imported by standalone Node or `tsx` scripts, including `tools/*.ts`, migrations, seeds, and their transitive dependencies, must not rely on Nuxt-only aliases like `~/` or `@@/`. Use package-backed `#server/*` or `#shared/*` aliases only when needed.
- Implement only requested behavior, reproducible fixes, or currently supported project scenarios. Treat hypothetical compatibility work as follow-up unless the user explicitly scopes it in.
- After any architecture, route-convention, data-model, or test-strategy change, update the relevant docs in the same change.

## Playwright guardrails

- Run new Playwright scenarios against their individual spec file before the full `pnpm run test:e2e:ci` suite.
- `context.route(...)` matchers must account for query strings whenever the real endpoint is requested with query parameters.
- Mocked-auth E2E flows should not call `page.goto()` after login unless the test also establishes a real server-side session cookie.
- Browser tests through `wrangler dev` must keep Wrangler state, logs, and config under a writable temp directory instead of the user's default `~/.config`.

## Verification

- Markdown changes: `pnpm run lint:markdown`.
- TypeScript or Vue changes: `pnpm run test:typecheck`, `pnpm run test:unit:agent`, `pnpm run lint:oxlint`, `pnpm run build`, and `pnpm run test:e2e:ci`.
- Run applicable checks in parallel where practical.