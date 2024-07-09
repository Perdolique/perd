<template>
  <button :class="$style.button">
    <slot />
  </button>
</template>

<style module>
  .button {
    height: var(--input-height);
    padding: 0 var(--input-spacing-horizontal);
    background-color: var(--input-color-main);
    border: none;
    border-radius: var(--border-radius-2);
    color: var(--color-white);
    cursor: pointer;
    outline: none;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:focus-visible,
    &:hover {
      background-color: var(--input-color-focus);
    }

    &:active {
      background-color: var(--color-blue-800);
    }

    &:disabled {
      color: var(--color-blue-700);
      background-color: var(--color-blue-100);
      cursor: not-allowed;
    }
  }
</style>
