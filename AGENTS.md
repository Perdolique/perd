# Agents instructions

## Chat style

- Use the `caveman` skill for chat responses before any other things.
- Keep all Markdown headings in Sentence case.

## Web baseline 2025

- The project targets **Baseline 2025** across all web technologies, including CSS, HTML, and JS browser APIs.
- We do not chase legacy browser support. Always choose modern native features over polyfills, fallbacks, or compatibility workarounds when they simplify the code.

## Verification

- Run applicable checks in parallel where practical.
- You can pass only changed file paths to the test and lint commands during development, but verify that the full suite passes at the end of the change.

## Local dev servers

- If a default port is already in use, first consider that a dev server may already be running there. Prefer testing against the existing server when appropriate, for example with Playwright, instead of starting another server automatically.

### Markdown file changes

- `vp run lint:markdown`.

### TypeScript or Vue file changes

- `vp run test:typecheck`
- `vp run test:unit:agent`
- `vp run lint:oxlint:agent`

### Playwright test changes

- `vp run test:e2e:ci`
