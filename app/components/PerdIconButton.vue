<template>
  <button
    :type="type"
    :class="[$style.component, variant]"
    :aria-label="label"
    :aria-busy="ariaBusy"
    :disabled="isButtonDisabled"
  >
    <FidgetSpinner
      v-if="loading"
      :class="$style.icon"
      aria-hidden="true"
    />

    <Icon
      v-else
      :name="icon"
      :class="$style.icon"
      aria-hidden="true"
    />
  </button>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'

  interface Props {
    disabled?: boolean;
    icon: string;
    label: string;
    loading?: boolean;
    type?: 'button' | 'reset' | 'submit';
    variant?: 'danger' | 'neutral';
  }

  const {
    disabled = false,
    icon,
    label,
    loading = false,
    type = 'button',
    variant = 'neutral'
  } = defineProps<Props>()

  const ariaBusy = computed(() => loading || undefined)
  const isButtonDisabled = computed(() => disabled || loading)
</script>

<style module>
  .component {
    --icon-button-background-hover: var(--color-surface-tertiary);
    --icon-button-border-hover: var(--color-border-subtle);
    --icon-button-color: var(--color-text-muted);
    --icon-button-color-hover: var(--color-text-primary);
    --icon-button-focus-shadow: var(--shadow-focus);

    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2rem;
    block-size: 2rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--border-radius-6);
    background: transparent;
    color: var(--icon-button-color);
    cursor: pointer;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--icon-button-border-hover);
      background: var(--icon-button-background-hover);
      color: var(--icon-button-color-hover);
    }

    &:focus-visible {
      border-color: var(--icon-button-border-hover);
      background: var(--icon-button-background-hover);
      color: var(--icon-button-color-hover);
      outline: 0;
      box-shadow: var(--icon-button-focus-shadow);
    }

    &:global(.danger) {
      --icon-button-background-hover: var(--color-danger-subtle);
      --icon-button-border-hover: var(--color-danger-border);
      --icon-button-color-hover: var(--color-danger-primary);
      --icon-button-focus-shadow: 0 0 0 3px color-mix(in oklch, var(--color-danger-primary) 32%, transparent);
    }

    &:disabled {
      color: var(--color-text-muted);
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  .icon {
    flex-shrink: 0;
    font-size: 1rem;
  }
</style>
