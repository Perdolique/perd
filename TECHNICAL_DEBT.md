# Technical debt

## Nuxt 4.5 compatibility workarounds

### Nitro auto-imports

`experimental.nitroAutoImports` remains enabled because `@nuxt/icon` and other modules still rely on Nitro auto-imports. The underlying Nuxt migration is tracked in [nuxt/nuxt#34142](https://github.com/nuxt/nuxt/issues/34142).

Remove the option after the installed modules stop relying on Nitro auto-imports, then run `vp run dev` and `vp run build` to verify server runtime imports.
