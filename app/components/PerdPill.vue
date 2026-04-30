<template>
  <span :class="[$style.component, toneClass]">
    <slot />
  </span>
</template>

<script lang="ts">
  export type PerdPillTone = 'neutral' | 'success' | 'warning' | 'danger'
</script>

<script lang="ts" setup>
  import { computed } from 'vue'

  interface Props {
    tone?: PerdPillTone;
  }

  const {
    tone = 'neutral'
  } = defineProps<Props>()

  const toneClass = computed(() => tone === 'neutral' ? undefined : tone)
</script>

<style module>
  .component {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-4);
    inline-size: fit-content;
    max-inline-size: 100%;
    padding: 0.25rem var(--spacing-8);
    border-radius: var(--border-radius-pill);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-subtle);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    &:global(.success) {
      background: var(--color-success-subtle);
      border-color: transparent;
      color: var(--color-success);
    }

    &:global(.warning) {
      background: var(--color-warning-subtle);
      border-color: transparent;
      color: var(--color-warning);
    }

    &:global(.danger) {
      background: var(--color-danger-subtle);
      border-color: transparent;
      color: var(--color-danger);
    }
  }
</style>
