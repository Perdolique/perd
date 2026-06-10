# Agents instructions

## Web Baseline 2025

- The project targets **Baseline 2025** across all web technologies, including CSS, HTML, and JS browser APIs.
- We do not chase legacy browser support. Always choose modern native features over polyfills, fallbacks, or compatibility workarounds when they simplify the code.

## Verification

- Run applicable checks in parallel where practical.
- You can pass only changed file paths to the test and lint commands during development, but verify that the full suite passes at the end of the change.

### Markdown file changes

- `pnpm run lint:markdown`.

### TypeScript or Vue file changes

- `pnpm run test:typecheck`
- `pnpm run test:unit:agent`
- `pnpm run lint:oxlint:agent`

### Playwright test changes

- `pnpm run test:e2e:ci`
