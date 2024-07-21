<template>
  <div :class="$style.component">
    <Icon
      name="tabler:backpack"
      size="1.5em"
    />

    <span>
      Inventory is empty
    </span>
  </div>
</template>

<style module>
  .component {
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: var(--spacing-8);
    padding: var(--spacing-32);
    color: var(--input-color-main);
  }
</style>
