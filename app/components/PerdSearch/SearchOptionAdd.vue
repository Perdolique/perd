<template>
  <div :class="$style.component">
    <div :class="$style.name">
      <slot />
    </div>

    <div :class="$style.add">
      <Icon
        name="tabler:plus"
        size="1em"
      />

      Add
    </div>
  </div>
</template>

<style lang="scss" module>
  .component {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: var(--spacing-16);
    justify-content: space-between;
    padding: 0 var(--input-spacing-horizontal);
  }

  .name {
    @include overflow-ellipsis();
  }

  .add {
    display: flex;
    align-items: center;
    opacity: 0;
    column-gap: var(--spacing-4);
    font-size: var(--font-size-14);
    transition:
      opacity 0.15s ease-out,
      display 0.15s ease-out allow-discrete;

    .component:hover & {
      opacity: 1;
    }
  }
</style>
