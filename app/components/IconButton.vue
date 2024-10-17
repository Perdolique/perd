<template>
  <button
    :class="[$style.button, {
      small,
      secondary
    }]"
    :disabled="isButtonDisabled"
  >
    <FidgetSpinner v-if="loading" />

    <Icon
      v-else
      :name="icon"
      size="1em"
    />
  </button>
</template>

<script lang="ts" setup>
  import FidgetSpinner from './FidgetSpinner.vue';

  interface Props {
    readonly icon: string;
    readonly loading?: boolean;
    readonly disabled?: boolean;
    readonly secondary?: boolean;
    readonly small?: boolean;
  }

  const {
    small = false,
    loading = false,
    disabled = false
  } = defineProps<Props>()

  const isButtonDisabled = computed(() => {
    return disabled || loading
  });
</script>

<style module>
  .button {
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--button-height);
    height: var(--button-height);
    background-color: var(--button-color-background);
    border-radius: var(--button-border-radius);
    color: var(--button-color-text);
    font-size: 1.375rem;
    outline: none;
    transition: background-color 0.2s;

    &:global(.secondary) {
      background-color: var(--button-secondary-color-background);
      color: var(--button-secondary-color-text);
    }

    &:global(.small) {
      height: var(--button-small-height);
      width: var(--button-small-height);
      border-radius: var(--button-small-border-radius);
      font-size: 1.125rem;
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
      background-color: var(--button-color-background-disabled);
      color: var(--button-color-text-disabled);

      &:global(.secondary) {
        background-color: var(--button-secondary-color-background-disabled);
        color: var(--button-secondary-color-text-disabled);
      }
    }
  }
</style>
