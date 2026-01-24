# Vue Files Formatting

Vue single-file components follow strict indentation rules.

## Block Order and Indentation

```vue
<template>
  <div :class="$style.container">
    <h1>Title</h1>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    title: string;
  }

  const props = defineProps<Props>()

  function handleClick() {
    console.log('clicked')
  }
</script>

<style lang="scss" module>
  .container {
    padding: 16px;

    &:hover {
      background: var(--color-hover);
    }
  }
</style>
```

## Formatting Rules

1. **Block order**: `<template>`, `<script>`, `<style>`
2. **Template indent**: 1-level base indentation
3. **Script indent**: 1-level base indentation
4. **Style indent**: 1-level base indentation
5. **Consistency**: All blocks use same indentation level

## Why This Format

- Consistent visual structure across all components
- Easy to scan and navigate SFC blocks
- Matches Vue ecosystem conventions
- Better readability in editors
