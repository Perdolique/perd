<template>
  <button :class="[$style.button, {
    small,
    secondary
  }]">
    <slot />
  </button>
</template>

<script lang="ts" setup>
  interface Props {
    readonly secondary?: boolean;
    readonly small?: boolean;
  }

  withDefaults(defineProps<Props>(), {
    secondary: false,
    small: false
  });
</script>

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
    user-select: none;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:global(.secondary) {
      background-color: var(--input-secondary-color-main);
      color: var(--input-secondary-color-text);
      border: 1px solid var(--input-secondary-color-text);
    }

    &:global(.small) {
      height: var(--input-small-spacing);
      font-size: var(--font-size-12);
      border-radius: var(--border-radius-1);
    }

    &:focus-visible,
    &:hover {
      background-color: var(--input-color-focus);

      &:global(.secondary) {
        background-color: var(--input-secondary-color-focus);
      }
    }

    &:active {
      background-color: var(--input-color-active);

      &:global(.secondary) {
        background-color: var(--input-secondary-color-active);
      }
    }

    &:disabled {
      color: var(--color-blue-700);
      background-color: var(--color-blue-100);
      cursor: not-allowed;

      &:global(.secondary) {
        color: var(--input-secondary-color-disabled);
        background-color: var(--input-secondary-color-main);
        border-color: var(--input-secondary-color-disabled);
      }
    }
  }
</style>
