<template>
  <button :class="[$style.button, {
    [size]: true,
    secondary
  }]">
    <Icon
      class="icon"
      :name="iconName"
      size="1em"
    />
  </button>
</template>

<script lang="ts" setup>
   interface Props {
    readonly iconName: string;
    readonly secondary?: boolean;
    readonly size: 'm' | 's' | 'xs';
  }

  withDefaults(defineProps<Props>(), {
    secondary: false,
    size: 'm'
  });
</script>

<style module>
  .button {
    padding: 0;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--input-height);
    height: var(--input-height);
    background-color: var(--input-color-main);
    border-radius: var(--border-radius-16);
    color: var(--button-color-text);
    font-size: 1.375rem;
    cursor: pointer;
    outline: none;

    &:global(.secondary) {
      background-color: var(--input-secondary-color-main);
      color: var(--input-secondary-color-text);
      border: 1px solid var(--input-secondary-color-border);
    }

    &:global(.s) {
      height: var(--input-small-height);
      width: var(--input-small-height);
      border-radius: var(--input-small-border-radius);
      font-size: 1.125rem;
    }

    &:global(.xs) {
      height: var(--input-extra-small-height);
      width: var(--input-extra-small-height);
      border-radius: var(--input-extra-small-border-radius);
      font-size: 1rem;
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
  }
</style>
