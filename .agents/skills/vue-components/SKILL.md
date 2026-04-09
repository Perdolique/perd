---
name: vue-components
description: Vue component conventions and patterns for the Perd project. Use when creating new Vue components, editing existing .vue files, reviewing Vue code, adding styles to components, defining props/emits/slots, working with CSS Modules, writing media queries, or when the user mentions Vue components, component styling, CSS Modules, props, emits, or any .vue file changes. Apply these rules during code generation, code review, and refactoring of Vue components.
---

# Vue Component Conventions

## Component Structure

Use the standard order: `<template>`, `<script>`, `<style>`.

If a UI has a small, fixed number of known elements and all labels, props, and targets are already known, write those elements directly in the template. Do not introduce arrays, `v-for`, config objects, or extra computed state just to make static markup look generic. Use config-driven rendering only when the structure is genuinely dynamic or repeated enough to justify abstraction.

Type exports that other components need go in a separate non-setup script block above the setup block:

```vue
<script lang="ts">
  export type HeadingLevel = 1 | 2 | 3
</script>

<script lang="ts" setup>
  // component logic here
</script>
```

## Script

### Imports

Auto-imports are disabled. Every import must be explicit.

- Nuxt composables (`useRoute`, `useFetch`, `navigateTo`, `definePageMeta`, `useState`, `useCookie`, etc.) come from `#imports` — never from `#app`.
- `$fetch` comes from `'ofetch'` — it is not available through `#imports` when auto-imports are disabled.
- Vue APIs (`ref`, `computed`, `onMounted`, etc.) come from `'vue'`.
- VueUse composables come from `'@vueuse/core'`.
- Shared project code comes from `#shared/...`.
- Components use relative `~/components/...` paths.

```ts
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { $fetch } from 'ofetch'
import { definePageMeta, navigateTo, useRoute } from '#imports'
import { startPagePath } from '#shared/constants'
import PerdButton from '~/components/PerdButton.vue'
```

### Props

Define props with a plain interface (no `readonly`). Destructure with defaults where needed:

```ts
interface Props {
  headerText: string;
  cancelButtonText?: string;
}

const {
  cancelButtonText = 'Cancel'
} = defineProps<Props>()
```

### Emits

Always define a separate `type` or `interface` for emits — never inline in `defineEmits<>`.

When all events share the same parameter signature (or have no parameters), use a union type:

```ts
type Emits = (event: 'confirm' | 'cancel') => void

const emit = defineEmits<Emits>()
```

When events have different parameter signatures, use an interface:

```ts
interface Emits {
  click: (value: ClickValue) => void;
  update: (value: string) => void;
}

const emit = defineEmits<Emits>()
```

### Template Refs

Use `useTemplateRef` (Vue 3.5+), not the old `ref()` + template `ref=""` pattern:

```ts
const dialogRef = useTemplateRef<HTMLDialogElement>('dialog')
```

### Models

Use `defineModel` for two-way binding:

```ts
const isOpened = defineModel<boolean>({
  required: true
})
```

### SSR Safety

The project uses SSR (server-side rendering). Never access browser globals (`document`, `window`, `navigator`, etc.) directly in component code — it will crash on the server.

Use VueUse composables for DOM interactions instead. They handle SSR automatically by no-oping on the server:

- `useEventListener` — instead of `document.addEventListener` / `element.addEventListener`
- `onClickOutside` — instead of manual pointerdown + contains checks
- Other `@vueuse/core` composables as needed

```ts
// Correct — SSR-safe
import { useEventListener } from '@vueuse/core'

useEventListener(dialogRef, 'close', () => {
  isOpened.value = false
})

// Wrong — crashes during SSR
document.addEventListener('pointerdown', handler)
```

## Accessibility

All UI must be accessible and meet at least **WCAG 2.1 AA**. Treat this as a project requirement, not a nice-to-have.

- Prefer semantic HTML over `div` / `span` plus manual `role` attributes when a native element already provides the correct behavior.
- All interactive elements must be keyboard accessible and have a visible focus state.
- Icon-only buttons, form inputs, and custom controls must have an accessible name via `aria-label`, `aria-labelledby`, or an associated `label`.
- Decorative elements should be hidden from assistive technology with `aria-hidden="true"`. Informative images must have a meaningful `alt`.
- Do not rely on color alone to communicate meaning, state, or validation errors.
- If a custom control is necessary, it must match the native equivalent's keyboard, focus, and ARIA behavior.

## Styling

### CSS Modules Only

Every component uses `<style module>` — never `<style scoped>`. The root class is always `.component`:

```vue
<template>
  <div :class="$style.component">
    ...
  </div>
</template>

<style module>
  .component {
    display: flex;
  }
</style>
```

### Modifier Pattern with :global()

State-based class modifiers use plain string classes in the template combined with `&:global(.modifier)` in CSS. This is the project's established convention for CSS Modules — it is intentional and correct:

```vue
<template>
  <div :class="[$style.component, { visible: isVisible }]">
    ...
  </div>
</template>

<style module>
  .component {
    opacity: 0;

    &:global(.visible) {
      opacity: 1;
    }
  }
</style>
```

The modifier string (e.g., `visible`, `active`, `small`) is a plain class name — not a `$style` reference. The `&:global(.modifier)` selector escapes the CSS Module hashing so it matches the plain class.

### CSS Features (Baseline 2025)

The project targets modern browsers only. Use these freely:

- **Native CSS nesting** — no preprocessors
- **`oklch()` color function** with `prefers-color-scheme` for light/dark themes
- **`@starting-style`** + `allow-discrete` for animating `display: none` transitions
- **Range media queries** — `@media (width >= 768px)`, never `@media screen and (min-width: 768px)`
- **`@layer`** for CSS organization (reset, colors, spacings, sizes, transitions, typography)
- **CSS custom properties** for all design tokens (`--spacing-*`, `--color-*`, `--font-size-*`, etc.)

Prefer native CSS features that are already part of the supported browser baseline over legacy compatibility workarounds.

### Responsive Rules

Use `@container` for component-level responsive layout changes that should react to the space actually available inside the component.

Keep `@media` for viewport- and environment-level behavior such as app shell breakpoints, fullscreen page treatments, overlays, and user preference queries like `prefers-color-scheme`.

### Media Queries

Use the modern range syntax:

```css
/* Correct */
@media (width >= 768px) {
  ...
}

/* Wrong */
@media screen and (min-width: 768px) {
  ...
}
```
