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
  import { computed } from 'vue';
  import FidgetSpinner from '@/components/FidgetSpinner.vue';

  interface Props {
    icon?: string;
    secondary?: boolean;
    small?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }

  const { disabled, loading } = defineProps<Props>();

  const isButtonDisabled = computed(() => disabled || loading)
</script>

<style module>
  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: var(--spacing-8);
    height: var(--spacing-48);
    padding: 0 var(--spacing-24);
    border-radius: var(--border-radius-16);
    background-color: var(--color-primary);
    color: var(--color-primary-50);
    outline: none;
    user-select: none;
    white-space: nowrap;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:global(.secondary) {
      background-color: var(--color-accent-200);
      color: var(--color-accent-800);
    }

    &:global(.small) {
      height: var(--spacing-32);
      border-radius: var(--border-radius-12);
      font-size: var(--font-size-14);
      padding: 0 var(--spacing-16);
      column-gap: var(--spacing-4);
    }

    &:focus-visible,
    &:hover {
      background-color: var(--color-primary-600);

      &:global(.secondary) {
        background-color: var(--color-accent-300);
      }
    }

    &:active {
      background-color: var(--color-primary-700);

      &:global(.secondary) {
        background-color: var(--color-accent-400);
      }
    }

    &:disabled {
      color: var(--color-primary-100);
      background-color: var(--color-primary-300);

      &:global(.secondary) {
        color: var(--color-accent-600);
        background-color: var(--color-accent-100);
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
