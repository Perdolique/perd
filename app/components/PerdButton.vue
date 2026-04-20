<template>
  <button
    :type="type"
    :disabled="isButtonDisabled"
    :aria-busy="ariaBusy"
    :data-size="size"
    :data-variant="variant"
    :class="$style.button"
  >
    <FidgetSpinner
      v-if="loading"
      :class="$style.icon"
    />

    <Icon
      v-else-if="icon"
      :name="icon"
      :class="$style.icon"
    />

    <slot />

    <Icon
      v-if="showRightIcon"
      :name="rightIconName"
      :class="$style.icon"
    />
  </button>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'

  interface Props {
    disabled?: boolean;
    icon?: string;
    iconRight?: string;
    loading?: boolean;
    size?: 'md' | 'sm' | 'icon' | 'icon-sm';
    type?: 'button' | 'reset' | 'submit';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  }

  const {
    disabled,
    iconRight,
    loading = false,
    size = 'md',
    type = 'button',
    variant = 'primary'
  } = defineProps<Props>()

  const ariaBusy = computed(() => loading || undefined)
  const isButtonDisabled = computed(() => disabled || loading)
  const rightIconName = computed(() => iconRight ?? '')
  const showRightIcon = computed(() => iconRight !== undefined && iconRight !== '' && loading === false)
</script>

<style module>
  .button {
    appearance: none;
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    height: 2.5rem;
    padding: 0 var(--spacing-16);
    border-radius: var(--border-radius-16);
    background: var(--color-accent-base);
    color: var(--color-accent-contrast);
    outline: none;
    user-select: none;
    white-space: nowrap;
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-14);
    transition:
      background-color var(--transition-duration-quick) var(--transition-easing-out),
      border-color var(--transition-duration-quick) var(--transition-easing-out),
      color var(--transition-duration-quick) var(--transition-easing-out),
      transform var(--transition-duration-quick) var(--transition-easing-out);

    &[data-size="sm"] {
      height: 2rem;
      padding: 0 var(--spacing-12);
      border-radius: var(--border-radius-12);
      font-size: var(--font-size-12);
    }

    &[data-size="icon"],
    &[data-size="icon-sm"] {
      padding: 0;
    }

    &[data-size="icon"] {
      width: 2.5rem;
    }

    &[data-size="icon-sm"] {
      width: 2rem;
      height: 2rem;
      border-radius: var(--border-radius-12);
    }

    &[data-variant="secondary"] {
      background: var(--color-surface-base);
      color: var(--color-text-primary);
      border-color: var(--color-border-default);
    }

    &[data-variant="ghost"] {
      background: transparent;
      color: var(--color-text-secondary);
    }

    &[data-variant="danger"] {
      background: transparent;
      color: var(--color-danger);
      border-color: color-mix(in oklch, var(--color-danger), transparent 76%);
    }

    &:focus-visible,
    &:hover {
      background: var(--color-accent-hover);
    }

    &[data-variant="secondary"]:focus-visible,
    &[data-variant="secondary"]:hover {
      background: var(--color-surface-subtle);
      border-color: var(--color-border-default);
      color: var(--color-text-primary);
    }

    &[data-variant="ghost"]:focus-visible,
    &[data-variant="ghost"]:hover {
      background: var(--color-surface-subtle);
      color: var(--color-text-primary);
    }

    &[data-variant="danger"]:focus-visible,
    &[data-variant="danger"]:hover {
      background: color-mix(in oklch, var(--color-danger), transparent 90%);
    }

    &:active {
      transform: translateY(1px);
      background: var(--color-accent-active);
    }

    &[data-variant="secondary"]:active,
    &[data-variant="ghost"]:active,
    &[data-variant="danger"]:active {
      transform: translateY(1px);
    }

    &:disabled {
      cursor: not-allowed;
      transform: none;
      color: var(--color-text-muted);
      background: var(--color-surface-subtle);
      border-color: transparent;
    }
  }

  .icon {
    font-size: 1.05em;
    flex-shrink: 0;
  }
</style>
