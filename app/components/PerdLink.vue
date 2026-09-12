<template>
  <component
    :is="rootComponent"
    :to="linkTarget"
    :role="linkRole"
    :aria-disabled="linkAriaDisabled"
    :tabindex="linkTabIndex"
    :class="$style.component"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { RouteLocationRaw } from 'vue-router'
  import { NuxtLink } from '#components'

  interface Props {
    disabled?: boolean;
    to: RouteLocationRaw;
  }

  const { disabled, to } = defineProps<Props>()
  const rootComponent = computed(() => disabled ? 'span' : NuxtLink)
  const linkTarget = computed(() => disabled ? undefined : to)
  const linkRole = computed(() => disabled ? 'link' : undefined)
  const linkAriaDisabled = computed(() => disabled || undefined)
  const linkTabIndex = computed(() => disabled ? -1 : undefined)
</script>

<style module>
  .component {
    color: var(--color-accent-primary);
    position: relative;
    text-decoration: none;
    transition:
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);
    cursor: pointer;
    font-weight: var(--font-weight-semibold);

    &:hover {
      text-decoration: underline;
      color: var(--color-accent-hover);
    }

    &:focus-visible {
      text-decoration: underline;
      color: var(--color-accent-hover);
      box-shadow: var(--shadow-focus);
    }

    &:active {
      color: var(--color-accent-active);
    }

    &[aria-disabled='true'] {
      color: var(--color-text-muted);
      cursor: not-allowed;
      text-decoration: none;
    }
  }
</style>
