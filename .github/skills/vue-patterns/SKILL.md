---
name: vue-patterns
description: Vue and Nuxt patterns including script setup with TypeScript, CSS modules, component props, and composable patterns. Use when creating or modifying Vue components, composables, Nuxt features, or when user mentions Vue, Nuxt, components, props, emits, composables, CSS modules, v-model, reactivity, or styling.
license: Unlicense
---

# Vue/Nuxt Patterns

Vue 3 and Nuxt 4 patterns with TypeScript.

## Quick Reference

- **Components**: See [components.md](references/components.md) for props, emits, composables usage, and v-model
- **Formatting**: See [formatting.md](references/formatting.md) for Vue SFC formatting rules
- **Styling**: See [styling.md](references/styling.md) for CSS modules, dynamic classes, and SCSS utilities
- **Composables**: See [composables.md](references/composables.md) for state management and store patterns

## Core Principles

- Always use `<script lang="ts" setup>` with strict typing
- Prefer CSS modules over scoped styles
- Named functions in composables (not arrow functions)
- useState for cross-component state
- Explicit emit types for better type safety
- Import types separately: `import type { ... }`
- Use computed for derived state
- SCSS utilities: `@include media-sm`, `@include overflow-ellipsis`
