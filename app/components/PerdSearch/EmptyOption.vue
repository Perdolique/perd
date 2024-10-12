<template>
  <div :class="$style.component">
    <slot />
  </div>
</template>

<style module>
  .component {
    height: 100%;
    align-content: center;
    color: var(--dropdown-option-color-placeholder);
    padding: var(--dropdown-option-padding);
  }
</style>
