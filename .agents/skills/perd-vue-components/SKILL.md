---
name: perd-vue-components
description: Perd-specific Vue SFC conventions for imports and responsive styling. Use whenever creating or reviewing `.vue` files in Perd. Excludes framework routing and app-level data fetching.
---

# Perd Vue component conventions

Apply these project-specific rules with the repository instructions and nearby component patterns.

## Imports

- Auto-imports are disabled. Import every dependency explicitly.
- Import Vue APIs from `vue`, VueUse composables from `@vueuse/core`, and shared project code from `#shared/...`.
- Follow the owning feature's existing component import paths and ordering.

## Responsive styles

- Use container queries for component layouts that respond to available component space.
- Keep media queries for viewport layout, app-shell behavior, overlays, and user preferences.
