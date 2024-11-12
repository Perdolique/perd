<template>
  <button
    type="button"
    :class="$style.component"
  >
    <Icon name="tabler:edit" />
  </button>
</template>

<style module>
  .component {
    display: inline-flex;
    color: var(--secondary-500);
    position: relative;
    top: 0.125em;
    outline: 1px solid transparent;
    background-color: transparent;
    border-radius: 0.25em;
    padding: 0.125em;
    margin: -0.25em 0;
    transition:
      background-color var(--transition-time-quick),
      outline-color var(--transition-time-quick),
      color var(--transition-time-quick);

    &:hover,
    &:focus-visible {
      background-color: var(--secondary-100);
      outline-color: var(--secondary-300);
      color: var(--secondary-600);
    }

    &:active {
      background-color: var(--secondary-200);
      outline-color: var(--secondary-400);
      color: var(--secondary-700);
    }
  }
</style>
