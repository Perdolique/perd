<template>
  <div :class="$style.component">
    <slot />
  </div>
</template>

<style module>
  .component {
    display: flex;
    height: 100%;
    align-items: center;
    color: var(--input-color-placeholder);
    padding: 0 var(--input-spacing-horizontal);
  }
</style>
