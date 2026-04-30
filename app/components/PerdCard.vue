<template>
  <div :class="$style.component">
    <slot />
  </div>
</template>

<style module>
  .component {
    background: var(--color-surface-base);
    border-radius: var(--border-radius-16);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
  }
</style>
