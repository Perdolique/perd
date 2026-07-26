# Agents instructions

## Chat style

- Keep all Markdown headings in Sentence case.

## Web baseline 2025

- The project targets **Baseline 2025** across all web technologies, including CSS, HTML, and JS browser APIs.
- We do not chase legacy browser support. Always choose modern native features over polyfills, fallbacks, or compatibility workarounds when they simplify the code.

## Technical debt

- Compatibility workarounds and their removal conditions are documented in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md). Consult it when changing framework configuration or dependency overrides.

## Verification

- Run applicable checks in parallel where practical.
- During development, run only focused checks for the code changed. Do not run full suites manually unless the user explicitly asks; commit hooks run the mandatory verification suite.
- If you are creating a commit, do not run the mandatory verification suite manually first; commit hooks will run it.
- Pass changed file paths to test and lint commands when supported; otherwise use the narrowest applicable focused command.

## Local dev servers

- If a default port is already in use, first consider that a dev server may already be running there. Prefer testing against the existing server when appropriate, for example with Playwright, instead of starting another server automatically.

### Markdown file changes

- `vp run lint:markdown`.

### TypeScript or Vue file changes

- `vp run test:typecheck`
- `vp run test:unit:agent`
- `vp run lint:oxlint:agent`

### Playwright test changes

- `vp run test:e2e`

### Playwright conventions

- Import `test` and `expect` from `tests/playwright/fixtures/global.fixtures.ts`, not from `@playwright/test`.
- When a flow should cancel stale requests, assert the obsolete request fails with `requestfailed`; final UI state alone is insufficient.
