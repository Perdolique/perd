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
    height: var(--button-height);
    padding: var(--button-padding);
    border-radius: var(--button-border-radius);
    background-color: var(--button-color-background);
    color: var(--button-color-text);
    outline: none;
    user-select: none;
    white-space: nowrap;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:has(:global(.icon)) {
      display: flex;
      align-items: center;
      column-gap: var(--button-gap);
    }

    &:global(.secondary) {
      background-color: var(--button-secondary-color-background);
      color: var(--button-secondary-color-text);
    }

    &:global(.small) {
      height: var(--button-small-height);
      border-radius: var(--button-small-border-radius);
      font-size: var(--button-small-font-size);
      padding: var(--button-small-padding);

      &:has(:global(.icon)) {
        column-gap: var(--button-small-gap);
      }
    }

    &:focus-visible,
    &:hover {
      background-color: var(--button-color-background-hover);

      &:global(.secondary) {
        background-color: var(--button-secondary-color-background-hover);
      }
    }

    &:active {
      background-color: var(--button-color-background-active);

      &:global(.secondary) {
        background-color: var(--button-secondary-color-background-active);
      }
    }

    &:disabled {
      color: var(--button-color-text-disabled);
      background-color: var(--button-color-background-disabled);

      &:global(.secondary) {
        color: var(--button-secondary-color-text-disabled);
        background-color: var(--button-secondary-color-background-disabled);
      }
    }
  }
</style>
