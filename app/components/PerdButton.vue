<template>
  <button
    :type="type"
    :disabled="isButtonDisabled"
    :aria-busy="ariaBusy"
    :class="[$style.button, {
      small: isSmallSize,
      iconOnly: isIconOnlySize,
      iconSmall: isIconSmallSize,
      secondary: isSecondaryVariant,
      ghost: isGhostVariant,
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
    size?: 'medium' | 'small' | 'icon-only' | 'icon-small';
    type?: 'button' | 'reset' | 'submit';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
  const isIconOnlySize = computed(() => size === 'icon-only')
  const isIconSmallSize = computed(() => size === 'icon-small')
  const isSecondaryVariant = computed(() => variant === 'secondary')
  const isGhostVariant = computed(() => variant === 'ghost')
  const isDangerVariant = computed(() => variant === 'danger')
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

    &:focus-visible,
    &:hover {
      background: var(--color-accent-hover);
    }

    &:active {
      transform: translateY(1px);
      background: var(--color-accent-active);
    }

    &:global(.small) {
      height: 2rem;
      padding: 0 var(--spacing-12);
      border-radius: var(--border-radius-12);
      font-size: var(--font-size-12);
    }

    &:global(.iconOnly),
    &:global(.iconSmall) {
      padding: 0;
    }

    &:global(.iconOnly) {
      width: 2.5rem;
    }

    &:global(.iconSmall) {
      width: 2rem;
      height: 2rem;
      border-radius: var(--border-radius-12);
    }

    &:global(.secondary) {
      background: var(--color-surface-base);
      color: var(--color-text-primary);
      border-color: var(--color-border-default);

      &:focus-visible,
      &:hover {
        background: var(--color-surface-subtle);
        border-color: var(--color-border-default);
        color: var(--color-text-primary);
      }

      &:active {
        transform: translateY(1px);
      }
    }

    &:global(.ghost) {
      background: transparent;
      color: var(--color-text-secondary);

      &:focus-visible,
      &:hover {
        background: var(--color-surface-subtle);
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

      &:focus-visible,
      &:hover {
        background: color-mix(in oklch, var(--color-danger), transparent 90%);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .button:disabled,
  .button:disabled:focus-visible,
  .button:disabled:hover,
  .button:disabled:active {
    cursor: not-allowed;
    transform: none;
    color: var(--color-text-muted);
    background: var(--color-surface-subtle);
    border-color: transparent;
  }

  .icon {
    font-size: 1.05em;
    flex-shrink: 0;
  }
</style>
