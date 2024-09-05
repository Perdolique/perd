<template>
  <button :class="[$style.button, {
    small,
    secondary
  }]">
    <Icon
      v-if="icon"
      class="icon"
      :name="icon"
      size="1.25em"
    />

    <slot />
  </button>
</template>

<script lang="ts" setup>
  interface Props {
    readonly icon?: string;
    readonly secondary?: boolean;
    readonly small?: boolean;
  }

  defineProps<Props>();
</script>

<style module>
  .button {
    height: var(--input-height);
    padding: 0 var(--input-spacing-horizontal);
    background-color: var(--input-color-main);
    border: none;
    border-radius: var(--input-border-radius);
    color: var(--button-color-text);
    cursor: pointer;
    outline: none;
    user-select: none;
    white-space: nowrap;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:has(:global(.icon)) {
      display: flex;
      align-items: center;
      column-gap: var(--spacing-8);
    }

    &:global(.secondary) {
      background-color: var(--input-secondary-color-main);
      color: var(--input-secondary-color-text);
      border: 1px solid var(--input-secondary-color-border);
    }

    &:global(.small) {
      height: var(--input-small-height);
      font-size: var(--font-size-12);
      border-radius: var(--input-small-border-radius);

      &:has(:global(.icon)) {
        column-gap: var(--spacing-4);
      }
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
