# Technical debt

## Nuxt 4.6 compatibility workarounds

### Portable request type inference

Nuxt 4.6's portable `defineEventHandler` returns `EventHandler<Result>` without the callback's body or query shape. Nitro 2's request type extractor only reads `H3Event<Request>`. `shared/types/api-request.d.ts` preserves the callback type and carries each validator's input on `ApiRequestEvent`. The public `server:routes` hook registers its request type extractors after the server builder has registered its own hooks. The extractors fall back to Nitro's public types for module-owned H3 routes.

Remove the declaration bridge and route hook after Nuxt preserves portable body and query contracts itself. Run `vp run test:typecheck` with the existing API request type assertions before removing them. Keep request input types based on the existing validation schemas and keep handler response types explicit.

### Nitro 2 request transport

The Nitro 2 adapter can buffer a Node request before exposing its portable Web Stream. `server/utils/request-runtime.ts` uses the H3 transport stream for bounded JSON and multipart reads, so an oversized request is rejected before its whole body is read. It gives cookie-only session helpers a stable header-only event and reads request headers and the method without starting that buffer. It also reads the local connection address when the portable request has no client address, and schedules background work with Nitro's request lifetime API. Application handlers use `nuxt/server`; the passkey error handler still uses Nitro's H3 error interface.

Remove these transport helpers when the installed server builder provides incremental Web Streams, the local client address, and a portable background-task API. Verify header reads do not start body consumption, body limits without Content-Length, request cancellation, password recovery background work, and image cleanup in the built Worker. Keep the standalone database CLI independent from the request runtime.

The application now uses Nuxt's sealed sessions with the existing secret, cookie name, and cookie policy. H3 cookies cannot be read in the new format; this migration resets existing sessions. Session-version checks still revoke stale sessions after password recovery.

### Early 404 error responses

Nuxt 4.6 enables `inlineErrorRendering` with compatibility version 5. Its renderer sends non-HTML early 404 errors through the Vue error page instead of returning JSON. Route middleware also runs while that error page renders, so authentication can replace a 404 with a login redirect. `experimental.inlineErrorRendering: false` keeps Nitro's HTML and JSON error response handling. The user, authentication, and admin middleware skip an active Nuxt error only during server rendering or hydration, so the error page can load and later navigation still requires authentication.

The default Nuxt error page also renders an empty server placeholder in this build and causes a hydration mismatch. `app/error.vue` renders the error markup directly, shows safe messages, and clears the error before returning home.

Remove the `inlineErrorRendering` override after the installed Nuxt renderer returns JSON for non-HTML early 404 requests. Keep the error-aware middleware and run `vp run test:e2e tests/playwright/routing/early-404.test.ts` against the built Worker. Verify unknown pages return HTML or JSON 404, error-page recovery still requires authentication, and existing page and API authentication responses stay unchanged.

### Nitro declaration resolution

Nitro 2.13.4 re-exports extensionless paths from its declaration barrels. Nuxt 4.6 uses NodeNext resolution for its Node context, so the declarations fail to load and Nitro configuration types lose fields such as `errorHandler`, `moduleSideEffects`, and `cloudflare`. `typescript.nodeTsConfig` uses `module: 'preserve'` and `moduleResolution: 'bundler'` to resolve these declarations without a package patch.

Remove the Node context override after the installed Nitro declarations use explicit extensions. Run `vp run test:typecheck` and focused lint for `nuxt.config.ts` before removing it.

### Nitro Cloudflare Node compatibility detection

`wrangler.jsonc` explicitly includes `nodejs_compat` even though the configured compatibility date enables it by default in the Workers runtime. Nitro 2.13.4 only preserves native Node imports when it sees the explicit flag or generates the Wrangler configuration itself; without the flag, it replaces supported APIs such as `node:crypto` with non-functional `unenv` stubs during the build.

Remove the explicit flag after the installed Nitro version detects date-enabled Node compatibility while respecting `cloudflare.deployConfig: false`. Then build the Worker and verify email registration, email sign-in, and Twitch OAuth in a Workers runtime before deploying.

### SimpleWebAuthn reflection metadata

Nitro 2.13.4 removes the side-effect import of `reflect-metadata` from SimpleWebAuthn's certificate helpers. Its `@peculiar/x509` dependency then fails during module loading in the built Worker. `nitro.moduleSideEffects` preserves this dependency's initialization.

Remove the setting when the installed Nitro and SimpleWebAuthn versions preserve this initialization without it. Run the built Worker passkey integration tests before removing it; Node unit tests do not reproduce the bundling failure.

### Passkey 404 cache policy

Nitro 2.13.4 overwrites an existing `Cache-Control` header with `no-cache` for every error response with status 404. The custom passkey error handler delegates response creation to Nitro, then restores `Cache-Control: no-store` only for passkey API 404 responses.

Remove the custom error handler after the installed Nitro version preserves explicit cache headers on 404 responses. Run the built Worker passkey integration test and verify authenticated ownership failures still return 404 with `Cache-Control: no-store`.

## Wrangler test harness WebSocket forwarding

Wrangler 4.131.1 `createTestHarness` forwards outbound requests through Node `fetch`, which rejects WebSocket Upgrade requests. The passkey Worker test uses the matching Miniflare version's fetch helper for these upgrades and preserves real network access to isolated PostgreSQL. HTTP requests still use the original fetch.

Remove the test fetch override and direct Miniflare development dependency when Wrangler's harness supports outbound WebSocket upgrades. Keep the native Worker WebSocket client and rerun the Worker integration suite.
