# Technical debt

## Nuxt 4.5 compatibility workarounds

### Nitro auto-imports

`experimental.nitroAutoImports` remains enabled because `@nuxt/icon` and other modules still rely on Nitro auto-imports. The underlying Nuxt migration is tracked in [nuxt/nuxt#34142](https://github.com/nuxt/nuxt/issues/34142).

Remove the option after the installed modules stop relying on Nitro auto-imports, then run `vp run dev` and `vp run build` to verify server runtime imports.

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
