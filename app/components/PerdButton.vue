<template>
  <button
    :type="type"
    :disabled="isButtonDisabled"
    :aria-busy="ariaBusy"
    :class="[$style.component, {
      small: isSmallSize,
      secondary: isSecondaryVariant,
      danger: isDangerVariant
    }]"
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
    size?: 'medium' | 'small';
    type?: 'button' | 'reset' | 'submit';
    variant?: 'primary' | 'secondary' | 'danger';
  }

  const {
    disabled,
    iconRight,
    loading = false,
    size = 'medium',
    type = 'button',
    variant = 'primary'
  } = defineProps<Props>()

  const ariaBusy = computed(() => loading || undefined)
  const isButtonDisabled = computed(() => disabled || loading)
  const isSmallSize = computed(() => size === 'small')
  const isSecondaryVariant = computed(() => variant === 'secondary')
  const isDangerVariant = computed(() => variant === 'danger')
  const rightIconName = computed(() => iconRight ?? '')
  const showRightIcon = computed(() => iconRight !== undefined && iconRight !== '' && loading === false)
</script>

<style module>
  .component {
    appearance: none;
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    block-size: 2.5rem;
    padding-inline: var(--spacing-16);
    border-radius: var(--border-radius-16);
    background: var(--color-accent-base);
    color: var(--color-accent-contrast);
    outline: 2px solid transparent;
    outline-offset: 3px;
    user-select: none;
    white-space: nowrap;
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-14);
    transition:
      background-color var(--transition-duration-quick) var(--transition-easing-out),
      border-color var(--transition-duration-quick) var(--transition-easing-out),
      color var(--transition-duration-quick) var(--transition-easing-out),
      transform var(--transition-duration-quick) var(--transition-easing-out);

    &:hover {
      background: var(--color-accent-hover);
    }

    &:focus-visible {
      background: var(--color-accent-hover);
      outline-color: var(--color-accent-ring);
    }

    &:active {
      transform: translateY(1px);
      background: var(--color-accent-active);
    }

    &:global(.small) {
      block-size: 2rem;
      padding-inline: var(--spacing-12);
      border-radius: var(--border-radius-12);
      font-size: var(--font-size-12);
    }

    &:global(.secondary) {
      background: var(--color-surface-base);
      color: var(--color-text-primary);
      border-color: var(--color-border-default);

      &:hover {
        background: var(--color-surface-subtle);
        border-color: var(--color-border-default);
        color: var(--color-text-primary);
      }

      &:focus-visible {
        background: var(--color-surface-subtle);
        border-color: var(--color-border-default);
        color: var(--color-text-primary);
      }

      &:active {
        transform: translateY(1px);
      }
    }

    &:global(.danger) {
      background: transparent;
      color: var(--color-danger);
      border-color: color-mix(in oklch, var(--color-danger), transparent 76%);

      &:hover {
        background: color-mix(in oklch, var(--color-danger), transparent 90%);
      }

      &:focus-visible {
        background: color-mix(in oklch, var(--color-danger), transparent 90%);
        outline-color: color-mix(in oklch, var(--color-danger), transparent 48%);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .component:disabled,
  .component:disabled:focus-visible,
  .component:disabled:hover,
  .component:disabled:active {
    cursor: not-allowed;
    transform: none;
    color: var(--color-text-muted);
    background: var(--color-surface-subtle);
    border-color: transparent;
    outline-color: transparent;
  }

  .icon {
    font-size: 1.05em;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .component:active {
      transform: none;
    }
  }
</style>
