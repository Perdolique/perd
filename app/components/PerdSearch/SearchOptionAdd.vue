<template>
  <div :class="$style.component">
    <slot />

    <div :class="$style.add">
      <Icon
        name="tabler:plus"
        size="1em"
      />

      Add
    </div>
  </div>
</template>

<style module>
  .component {
    height: 100%;
    display: flex;
    align-items: center;
    column-gap: var(--spacing-16);
    justify-content: space-between;
    padding: 0 var(--input-spacing-horizontal);
    cursor: pointer;
    transition: background-color 0.15s ease-out;

    &:hover {
      background-color: var(--input-color-hover-bg);
    }
  }

  .add {
    display: none;
    opacity: 0;
    align-items: center;
    column-gap: var(--spacing-4);
    font-size: var(--font-size-14);
    transition:
      opacity 0.15s ease-out,
      display 0.15s ease-out allow-discrete;

    .component:hover & {
      display: flex;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }
  }
</style>
