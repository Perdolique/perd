<template>
  <button :class="$style.option">
    <div :class="$style.icon">
      <slot name="icon" />
    </div>

    <slot />
  </button>
</template>

<style module>
  .option {
    /* Reset button default style */
    outline: none;
    text-align: inherit;
    width: 100%;

    /* Option styles */
    height: 40px;
    display: grid;
    grid-template-columns: 20px 1fr;
    column-gap: var(--spacing-8);
    align-items: center;
    padding: 0 var(--spacing-32) 0 var(--spacing-12);
    background-color: transparent;
    color: var(--text-600);
    transition: background-color var(--transition-time-quick) ease-out;
    font-size: var(--font-size-14);
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      background-color: var(--secondary-100);
    }
  }

  .icon {
    display: flex;
    justify-self: center;
  }
</style>
