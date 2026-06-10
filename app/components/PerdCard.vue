<template>
  <div
    :class="[$style.component, paddingClass, {
      elevated,
      interactive
    }]"
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  interface Props {
    elevated?: boolean;
    interactive?: boolean;
    padding?: 'large' | 'medium' | 'none' | 'small';
  }

  const {
    elevated = false,
    interactive = false,
    padding = 'medium'
  } = defineProps<Props>()

  const paddingClass = computed(() => `padding-${padding}`)
</script>

<style module>
  .component {
    background: var(--color-surface-primary);
    border-radius: var(--border-radius-20);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:global(.padding-none) {
      padding: 0;
    }

    &:global(.padding-small) {
      padding: var(--spacing-12);
    }

    &:global(.padding-large) {
      padding: var(--spacing-24);
    }

    &:global(.elevated) {
      box-shadow: var(--shadow-small);
    }

    &:global(.interactive) {
      cursor: pointer;

      &:hover {
        background: var(--color-surface-secondary);
        box-shadow: var(--shadow-medium);
      }
    }
  }
</style>
