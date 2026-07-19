# Technical debt

## Nuxt 4.5 compatibility workarounds

### Unhead 3.2.0 build compatibility

Nuxt 4.5.0 can resolve Unhead 3.1.8, which fails to parse while Nitro builds the Cloudflare module preset. The failure is tracked in [nuxt/nuxt#35670](https://github.com/nuxt/nuxt/issues/35670) and was fixed in Unhead 3.2.0.

Nuxt accepts Unhead 3.2.0 through its existing semver range. Because that release is newer than the package manager's supply-chain age policy, `pnpm-workspace.yaml` temporarily excludes `unhead`, `@unhead/vue`, and `@unhead/bundler` 3.2.0 from the minimum release age check.

The Unhead 3.2.0 Vite plugin also replaces the assignment target in `head.ssr = false`, producing the invalid expression `false = false`. No upstream issue for this second failure was found on July 19, 2026. `nuxt.config.ts` therefore disables the Unhead Vite build transforms while keeping the runtime enabled.

Remove the minimum release age exclusions after Unhead 3.2.0 passes the configured age window. Re-enable `unhead.vite` after `@unhead/bundler` fixes assignment-target replacement, then run `vp install` and `vp run build` to verify the client and Cloudflare builds.

### Nitro auto-imports

`experimental.nitroAutoImports` remains enabled because `@nuxt/icon` and other modules still rely on Nitro auto-imports. The underlying Nuxt migration is tracked in [nuxt/nuxt#34142](https://github.com/nuxt/nuxt/issues/34142).

Remove the option after the installed modules stop relying on Nitro auto-imports, then run `vp run dev` and `vp run build` to verify server runtime imports.
