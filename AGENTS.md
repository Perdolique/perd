# Agents instructions

## Chat style

- Keep all Markdown headings in Sentence case.

## Web baseline 2025

- The project targets **Baseline 2025** across all web technologies, including CSS, HTML, and JS browser APIs.
- We do not chase legacy browser support. Always choose modern native features over polyfills, fallbacks, or compatibility workarounds when they simplify the code.

## Technical debt

- Compatibility workarounds and their removal conditions are documented in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md). Consult it when changing framework configuration or dependency overrides.

## Verification

- Local development uses Vite+. When documenting or running local commands, use `vp` instead of `pnpm`.
- Run applicable checks in parallel where practical.
- During development, run only focused checks for the code changed. Do not run full suites manually unless the user explicitly asks; commit hooks run the mandatory verification suite.
- If you are creating a commit, do not run the mandatory verification suite manually first; commit hooks will run it.
- Pass changed file paths to test and lint commands when supported; otherwise use the narrowest applicable focused command.

## Local dev servers

- If a default port is already in use, first consider that a dev server may already be running there. Prefer testing against the existing server when appropriate, for example with Playwright, instead of starting another server automatically.

### Markdown file changes

- `vp run lint:markdown`.

### TypeScript or Vue file changes

- Run `vp run format` and wait for it to finish before starting the remaining checks.
- `vp run test:typecheck`
- `vp run test:unit:agent`
- `vp run lint:oxlint:agent`

### Playwright test changes

- Run the changed test files with `vp run test:e2e <file>`.
- Use `vp run test:e2e --grep "<test name>"` when only specific scenarios are affected.
- Do not run the whole end-to-end test suite unless explicitly asked.

### Playwright conventions

- Import `test` and `expect` from `tests/playwright/fixtures/global.fixtures.ts`, not from `@playwright/test`.
- When a flow should cancel stale requests, assert the obsolete request fails with `requestfailed`; final UI state alone is insufficient.

## Local database

- During local development, agents may use `psql` with `NUXT_DATABASE_URL` to inspect actual database state whenever it helps diagnose, implement, or verify the current task, even when the task did not begin as database work.
- Before changing data directly, verify that `NUXT_LOCAL_DATABASE` is enabled. Local development data is disposable: agents may insert, update, or delete it without additional approval when doing so supports the current task.
- This permission applies only to the local database. Never infer the same permission for staging or production.
- Never print database URLs, credentials, or secret values.
- Report material data mutations and what was removed or changed.
