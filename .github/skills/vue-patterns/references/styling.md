# CSS Modules

Use CSS modules with SCSS for component styling.

**Rules:**

- Always use 1-level indentation inside `<style>`
- Use global classes for modifiers instead of separate CSS module classes

## Basic CSS Module

```vue
<template>
  <button :class="$style.button">
    Click me
  </button>
</template>

<style lang="scss" module>
  .button {
    @include overflow-ellipsis();

    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;

    &:hover {
      background-color: var(--color-hover);
    }

    @include tablet() {
      width: 100%;
      justify-content: center;
    }
  }
</style>
```

## Modifiers with Global Classes

```vue
<template>
  <button
    :class="[$style.button, {
      small,
      secondary,
      disabled
    }]"
  >
    Click me
  </button>
</template>

<style lang="scss" module>
  .button {
    padding: 12px 16px;
    border-radius: 8px;

    &:global(.small) {
      padding: 8px 12px;
      font-size: 14px;
    }

    &:global(.secondary) {
      background-color: var(--color-secondary);
    }

    &:global(.disabled) {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
```

## Available SCSS Utilities

**Text utilities:**

- `@include overflow-ellipsis()` - Text overflow with ellipsis

**Media query mixins:**

- `@include mobileMedium()` - Min-width: mobile-medium breakpoint
- `@include mobileLarge()` - Min-width: mobile-large breakpoint
- `@include tablet()` - Min-width: tablet breakpoint
- `@include laptop()` - Min-width: laptop breakpoint

Defined in `app/assets/styles/_utils.scss` and `app/assets/styles/_media.scss`

## Key Principles

1. **Always indent** - Use 1-level indentation for all rules inside `<style>`
2. **Nested pseudo** - Use `&:hover`, `&:focus` instead of separate selectors
3. **Global modifiers** - Use `&:global(.className)` for modifiers instead of creating separate CSS module classes
4. **Media queries inside** - Nest `@include tablet()` inside the class, not outside
