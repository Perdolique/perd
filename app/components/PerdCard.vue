<template>
  <div :class="$style.component">
    <slot />
  </div>
</template>

<style module>
  .component {
    background-color: var(--background-50);
    border-radius: var(--border-radius-16);
    padding: var(--spacing-24);
    border: 1px solid var(--background-100);
  }
</style>
