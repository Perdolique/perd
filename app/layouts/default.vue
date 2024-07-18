<template>
  <div :class="$style.component">
    <NavigationBar />

    <div :class="$style.content">
      <slot />
    </div>
  </div>
</template>

<style module>
  .component {
    display: grid;
    grid-template-rows: auto 1fr;
    row-gap: var(--spacing-16);
  }

  .content {
    display: grid;
    width: 100%;
    padding: var(--spacing-16);
  }
</style>
