<template>
  <component
    :is="rootComponent"
    ref="buttonRef"
    :type="buttonType"
    :to="linkTarget"
    :role="linkRole"
    :disabled="buttonDisabled"
    :aria-disabled="linkAriaDisabled"
    :aria-busy="ariaBusy"
    :tabindex="linkTabIndex"
    :class="[$style.component, {
      small: isSmallSize,
      large: isLargeSize,
      secondary: isSecondaryVariant,
      soft: isSoftVariant,
      ghost: isGhostVariant,
      danger: isDangerVariant,
      block
    }]"
    @click.capture="handleClick"
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
  </component>
</template>

<script lang="ts" setup>
  import { computed, useTemplateRef, type ComponentPublicInstance } from 'vue'
  import type { RouteLocationRaw } from 'vue-router'
  import { NuxtLink } from '#components'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'

  interface Props {
    block?: boolean;
    disabled?: boolean;
    icon?: string;
    iconRight?: string;
    loading?: boolean;
    size?: 'large' | 'medium' | 'small';
    to?: RouteLocationRaw;
    type?: 'button' | 'reset' | 'submit';
    variant?: 'danger' | 'ghost' | 'primary' | 'secondary' | 'soft';
  }

  type ButtonRoot = ComponentPublicInstance | HTMLElement

  const {
    block = false,
    disabled,
    iconRight,
    loading = false,
    size = 'medium',
    to,
    type = 'button',
    variant = 'primary'
  } = defineProps<Props>()

  const buttonRef = useTemplateRef<ButtonRoot>('buttonRef')
  const isLink = computed(() => to !== undefined)
  const isButtonDisabled = computed(() => disabled || loading)
  const isLinkDisabled = computed(() => isLink.value && isButtonDisabled.value)

  const rootComponent = computed(() => {
    if (isLinkDisabled.value) {
      return 'span'
    }

    return isLink.value ? NuxtLink : 'button'
  })

  const buttonType = computed(() => isLink.value ? undefined : type)
  const buttonDisabled = computed(() => isLink.value ? undefined : isButtonDisabled.value)
  const linkTarget = computed(() => isLinkDisabled.value ? undefined : to)
  const linkRole = computed(() => isLinkDisabled.value ? 'link' : undefined)
  const linkAriaDisabled = computed(() => isLinkDisabled.value || undefined)
  const linkTabIndex = computed(() => isLinkDisabled.value ? -1 : undefined)
  const ariaBusy = computed(() => loading || undefined)
  const isSmallSize = computed(() => size === 'small')
  const isLargeSize = computed(() => size === 'large')
  const isSecondaryVariant = computed(() => variant === 'secondary')
  const isSoftVariant = computed(() => variant === 'soft')
  const isGhostVariant = computed(() => variant === 'ghost')
  const isDangerVariant = computed(() => variant === 'danger')
  const rightIconName = computed(() => iconRight ?? '')
  const showRightIcon = computed(() => iconRight !== undefined && iconRight !== '' && loading === false)

  function handleClick(event: MouseEvent) {
    if (isLinkDisabled.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  function focus() {
    const root = buttonRef.value
    const rootElement = root instanceof globalThis.HTMLElement ? root : root?.$el

    rootElement?.focus()
  }

  defineExpose({ focus })
</script>

<style module>
  .component {
    --button-background: var(--color-accent-primary);
    --button-background-hover: var(--color-accent-hover);
    --button-background-active: var(--color-accent-active);
    --button-border-color: var(--color-accent-border);
    --button-border-color-hover: var(--color-accent-border-hover);
    --button-shadow:
      inset 0 1px 0 color-mix(in oklch, var(--color-accent-contrast) 22%, transparent),
      0 10px 24px -18px color-mix(in oklch, var(--color-accent-primary) 62%, transparent);
    --button-text-color: var(--color-accent-contrast);

    appearance: none;
    border: 1px solid var(--button-border-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-24);
    border-radius: var(--layout-button-radius);
    background-color: var(--button-background);
    color: var(--button-text-color);
    box-shadow: var(--button-shadow);
    user-select: none;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    text-decoration: none;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard),
      color var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover:not(:disabled, [aria-disabled='true']) {
      border-color: var(--button-border-color-hover);
      background-color: var(--button-background-hover);
    }

    &:focus-visible {
      border-color: var(--button-border-color-hover);
      background-color: var(--button-background-hover);
      box-shadow: var(--shadow-focus), var(--button-shadow);
    }

    &:active:not(:disabled, [aria-disabled='true']) {
      border-color: var(--button-border-color-hover);
      background-color: var(--button-background-active);
    }

    &:global(.small) {
      min-block-size: var(--layout-button-height-small);
      padding-inline: var(--spacing-16);
      border-radius: var(--layout-button-radius-small);
      font-size: var(--font-size-14);
    }

    &:global(.large) {
      min-block-size: var(--layout-button-height-large);
      padding-inline: var(--spacing-32);
      font-size: var(--font-size-17);
    }

    &:global(.block) {
      inline-size: 100%;
    }

    &:global(.secondary) {
      --button-background: color-mix(in oklch, var(--color-background-elevated) 88%, var(--color-accent-subtle));
      --button-background-hover: var(--color-accent-subtle-hover);
      --button-background-active: var(--color-accent-subtle-active);
      --button-border-color: var(--color-border-strong);
      --button-border-color-hover: color-mix(in oklch, var(--color-accent-primary) 34%, transparent);
      --button-shadow: inset 0 1px 0 color-mix(in oklch, var(--color-white) 44%, transparent);
      --button-text-color: var(--color-text-primary);
    }

    &:global(.soft) {
      --button-background: var(--color-accent-subtle);
      --button-background-hover: var(--color-accent-subtle-hover);
      --button-background-active: var(--color-accent-subtle-active);
      --button-border-color: var(--color-accent-subtle-border);
      --button-border-color-hover: color-mix(in oklch, var(--color-accent-primary) 34%, transparent);
      --button-shadow: inset 0 1px 0 color-mix(in oklch, var(--color-background-elevated) 42%, transparent);
      --button-text-color: var(--color-accent-primary);
    }

    &:global(.ghost) {
      --button-background: transparent;
      --button-background-hover: var(--color-surface-tertiary);
      --button-background-active: var(--color-accent-subtle);
      --button-border-color: transparent;
      --button-border-color-hover: var(--color-border-subtle);
      --button-shadow: none;
      --button-text-color: var(--color-text-primary);
    }

    &:global(.danger) {
      --button-background: var(--color-danger-subtle);
      --button-background-hover: var(--color-danger-subtle-hover);
      --button-background-active: color-mix(in oklch, var(--color-danger-primary) 32%, transparent);
      --button-border-color: var(--color-danger-border);
      --button-border-color-hover: color-mix(in oklch, var(--color-danger-primary) 42%, transparent);
      --button-shadow: inset 0 1px 0 color-mix(in oklch, var(--color-background-elevated) 36%, transparent);
      --button-text-color: var(--color-danger-primary);

      &:focus-visible {
        box-shadow:
          0 0 0 3px color-mix(in oklch, var(--color-danger-primary) 42%, transparent),
          var(--button-shadow);
      }
    }

    &:disabled,
    &[aria-disabled='true'] {
      cursor: not-allowed;
      background-color: var(--color-surface-secondary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-muted);
      box-shadow: inset 0 1px 0 color-mix(in oklch, var(--color-background-elevated) 48%, transparent);

      &:hover,
      &:focus-visible,
      &:active {
        cursor: not-allowed;
        background-color: var(--color-surface-secondary);
        border-color: var(--color-border-subtle);
        color: var(--color-text-muted);
        box-shadow: inset 0 1px 0 color-mix(in oklch, var(--color-background-elevated) 48%, transparent);
      }
    }
  }

  .icon {
    font-size: 1.1em;
    flex-shrink: 0;
  }

</style>
