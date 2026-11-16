# Technical debt

## TypeScript 7 compiler API compatibility

Keep `typescript` at 6.0.3 while the toolchain relies on its JavaScript compiler API. [TypeScript 7.0 does not provide that API](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), and tools such as typescript-eslint still need the TypeScript 6 API. This hold remains relevant when an agent updates dependencies.

Remove this hold after the installed toolchain supports the replacement compiler API or a verified side-by-side setup. Run `vp run test:typecheck` and focused TypeScript lint checks before removing it.

## vue-tsc code generation regressions

Keep `vue-tsc` at 3.3.11 until the code generation regressions are fixed. [Upstream issue #6240](https://github.com/vuejs/language-tools/issues/6240) remains open. Version 3.3.12 treats `//` inside inline URL strings as a line comment when it generates single-line component props. The `https://example.com/product` placeholder in `app/components/equipment/EquipmentItemEditor.vue` triggers this bug. The generated TypeScript becomes invalid and reports `TS2304` for existing template bindings and `TS6133` for their declarations. Version 3.3.14 also crashes this project's type check with `Debug Failure. Expected -12426 >= 0` in TypeScript's diagnostic location check. The same project passes with 3.3.11.

This hold also delays the 3.3.12 security fix for inline compiler plugins. After upstream publishes a fixed release, update `vue-tsc` without changing the placeholder and run `vp run test:typecheck`. Remove this entry after that check passes.

## Nuxt DevTools 4 opt-in

Nuxt 4.6 bundles Nuxt DevTools 3. The `@nuxt/devtools` override in `pnpm-workspace.yaml` uses the exact root dependency version so Nuxt and its modules use DevTools 4 together. The existing `devtools.enabled` setting stays enabled. Browser authorization stays enabled too.

Nuxt Hints 1.1.5 still calls the deprecated `extendServerRpc` bridge and emits `NDT_DEP_0003` with DevTools 4. `vite-plugin-vue-devtools` 9.0.0-rc.3 still declares a `@vitejs/devtools ^0.7.6` peer while Nuxt DevTools 4.2.0 uses 0.8.3. The authorized Nuxt panel loads with that peer warning. Keep these upstream diagnostics visible rather than suppressing them.

Remove the override when the installed Nuxt version bundles DevTools 4. Start the dev server and verify the Nuxt group opens in the Vite DevTools panel.

## Nuxt 4.6 compatibility workarounds

### Development server hostname

Nuxt 4.6.4 resolves an unset `devServer.host` to an empty object. Nuxt CLI 4.0.1 stores that value in `node_modules/.cache/nuxt/dev-server.json`, then calls `.toLowerCase()` on it during the next eager server startup. `devServer.host: 'localhost'` keeps the local default address explicit and prevents that crash. CLI host flags and the supported host environment variables still take precedence.

Remove the explicit host after the installed Nuxt schema and CLI handle an unset hostname. Verify two consecutive starts of `vp run dev` without a host flag or host environment variable. If an older run left an object-valued hostname in the generated hint file, remove that invalid cache file before starting the server.

### Portable request type inference

Nuxt 4.6's portable `defineEventHandler` returns `EventHandler<Result>` without the callback's body or query shape. Nitro 2's request type extractor only reads `H3Event<Request>`. `shared/types/api-request.d.ts` preserves the callback type and carries each validator's input on `ApiRequestEvent`. The public `server:routes` hook registers its request type extractors after the server builder has registered its own hooks. The extractors fall back to Nitro's public types for module-owned H3 routes.

Remove the declaration bridge and route hook after Nuxt preserves portable body and query contracts itself. Run `vp run test:typecheck` with the existing API request type assertions before removing them. Keep request input types based on the existing validation schemas and keep handler response types explicit.

### Nitro 2 request transport

Nuxt 4.6.4 reads Node request bodies incrementally, but retains the chunks for repeated portable body reads. `server/utils/request-runtime.ts` uses the H3 transport stream for bounded JSON and multipart reads, so these reads do not keep a second replay buffer. It gives cookie-only session helpers a stable header-only event and reads request headers and the method without constructing the replayable request body. It also reads the local connection address when the portable request has no client address, and schedules background work with Nitro's request lifetime API. Application handlers use `nuxt/server`; the passkey error handler still uses Nitro's H3 error interface.

Remove these transport helpers when the installed server builder provides bounded reads without a replay buffer, the local client address, and a portable background-task API. Verify header reads do not start body consumption, body limits without Content-Length, request cancellation, password recovery background work, and image cleanup in the built Worker. Keep the standalone database CLI independent from the request runtime.

The application now uses Nuxt's sealed sessions with the existing secret, cookie name, and cookie policy. H3 cookies cannot be read in the new format; this migration resets existing sessions. Session-version checks still revoke stale sessions after password recovery.

### Early 404 error responses

Nuxt 4.6 enables `inlineErrorRendering` with compatibility version 5. Its renderer sends non-HTML early 404 errors through the Vue error page instead of returning JSON. Route middleware also runs while that error page renders, so authentication can replace a 404 with a login redirect. `experimental.inlineErrorRendering: false` keeps Nitro's HTML and JSON error response handling. The user, authentication, and admin middleware skip an active Nuxt error only during server rendering or hydration, so the error page can load and later navigation still requires authentication.

The default Nuxt error page also renders an empty server placeholder in this build and causes a hydration mismatch. `app/error.vue` renders the error markup directly, shows safe messages, and clears the error before returning home.

Remove the `inlineErrorRendering` override after the installed Nuxt renderer returns JSON for non-HTML early 404 requests. Keep the error-aware middleware and run `vp run test:e2e tests/playwright/routing/early-404.test.ts` against the built Worker. Verify unknown pages return HTML or JSON 404, error-page recovery still requires authentication, and existing page and API authentication responses stay unchanged.

### SimpleWebAuthn reflection metadata

Nitro 2.13.4 removes the side-effect import of `reflect-metadata` from SimpleWebAuthn's certificate helpers. Its `@peculiar/x509` dependency then fails during module loading in the built Worker. `nitro.moduleSideEffects` preserves this dependency's initialization.

Remove the setting when the installed Nitro and SimpleWebAuthn versions preserve this initialization without it. Run the built Worker passkey integration tests before removing it; Node unit tests do not reproduce the bundling failure.

### Passkey 404 cache policy

Nitro 2.13.4 overwrites an existing `Cache-Control` header with `no-cache` for every error response with status 404. The custom passkey error handler delegates response creation to Nitro, then restores `Cache-Control: no-store` only for passkey API 404 responses.

Remove the custom error handler after the installed Nitro version preserves explicit cache headers on 404 responses. Run the built Worker passkey integration test and verify authenticated ownership failures still return 404 with `Cache-Control: no-store`.

## Wrangler test harness WebSocket forwarding

Wrangler 4.131.1 `createTestHarness` forwards outbound requests through Node `fetch`, which rejects WebSocket Upgrade requests. The passkey Worker test uses the matching Miniflare version's fetch helper for these upgrades and preserves real network access to isolated PostgreSQL. HTTP requests still use the original fetch.

Remove the test fetch override and direct Miniflare development dependency when Wrangler's harness supports outbound WebSocket upgrades. Keep the native Worker WebSocket client and rerun the Worker integration suite.
