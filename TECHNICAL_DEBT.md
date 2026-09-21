# Technical debt

## Nuxt 4.5 compatibility workarounds

### Nitro auto-imports

`experimental.nitroAutoImports` remains enabled because `@nuxt/icon` and other modules still rely on Nitro auto-imports. The underlying Nuxt migration is tracked in [nuxt/nuxt#34142](https://github.com/nuxt/nuxt/issues/34142).

Remove the option after the installed modules stop relying on Nitro auto-imports, then run `vp run dev` and `vp run build` to verify server runtime imports.

### Nitro Cloudflare Node compatibility detection

`wrangler.jsonc` explicitly includes `nodejs_compat` even though the configured compatibility date enables it by default in the Workers runtime. Nitro 2.13.4 only preserves native Node imports when it sees the explicit flag or generates the Wrangler configuration itself; without the flag, it replaces supported APIs such as `node:crypto` with non-functional `unenv` stubs during the build.

Remove the explicit flag after the installed Nitro version detects date-enabled Node compatibility while respecting `cloudflare.deployConfig: false`. Then build the Worker and verify email registration, email sign-in, and Twitch OAuth in a Workers runtime before deploying.
