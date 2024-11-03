<template>
  <button
    :disabled="isButtonDisabled"
    :class="[$style.button, {
      small,
      secondary
    }]"
  >
    <FidgetSpinner
      v-if="loading"
      :class="[$style.icon, { small }]"
    />

    <Icon
      v-else-if="icon"
      :name="icon"
      :class="[$style.icon, { small }]"
    />

    <slot />
  </button>
</template>

<script lang="ts" setup>
  import FidgetSpinner from '@/components/FidgetSpinner.vue';

  interface Props {
    readonly icon?: string;
    readonly secondary?: boolean;
    readonly small?: boolean;
    readonly loading?: boolean;
    readonly disabled?: boolean;
  }

  const { disabled, loading } = defineProps<Props>();

  const isButtonDisabled = computed(() => {
    return disabled || loading
  });
</script>

<style module>
  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: var(--button-gap);
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

    &:global(.secondary) {
      background-color: var(--button-secondary-color-background);
      color: var(--button-secondary-color-text);
    }

    &:global(.small) {
      height: var(--button-small-height);
      border-radius: var(--button-small-border-radius);
      font-size: var(--button-small-font-size);
      padding: var(--button-small-padding);
      column-gap: var(--button-small-gap);
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

  .icon {
    font-size: 1.25em;

    &:global(.small) {
      font-size: 1.15em;
    }
  }
</style>
