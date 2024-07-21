<template>
  <div :class="$style.component">
    <slot />
  </div>
</template>

<style module>
  .component {
    height: var(--input-height);
  }
</style>
