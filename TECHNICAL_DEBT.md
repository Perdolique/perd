# Technical debt

## Wrangler development server stability

Wrangler remains pinned to 4.113.0 because 4.114.0 and later can terminate `wrangler dev` after a recoverable Miniflare runtime restart. The regression is tracked in [cloudflare/workers-sdk#14926](https://github.com/cloudflare/workers-sdk/issues/14926).

Upgrade Wrangler after the upstream issue is fixed in a release and the end-to-end job passes repeatedly with that release.

## Nuxt 4.5 compatibility workarounds

### Nitro auto-imports

`experimental.nitroAutoImports` remains enabled because `@nuxt/icon` and other modules still rely on Nitro auto-imports. The underlying Nuxt migration is tracked in [nuxt/nuxt#34142](https://github.com/nuxt/nuxt/issues/34142).

Remove the option after the installed modules stop relying on Nitro auto-imports, then run `vp run dev` and `vp run build` to verify server runtime imports.
