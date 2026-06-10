<template>
  <span :class="[$style.component, tone]">
    <slot />
  </span>
</template>

<script lang="ts">
  export type PerdPillTone = 'brand' | 'danger' | 'info' | 'neutral' | 'success' | 'warning'
</script>

<script lang="ts" setup>
  interface Props {
    tone?: PerdPillTone;
  }

  const {
    tone = 'neutral'
  } = defineProps<Props>()
</script>

<style module>
  .component {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-4);
    inline-size: fit-content;
    max-inline-size: 100%;
    padding: var(--spacing-4) var(--spacing-12);
    border-radius: var(--border-radius-pill);
    border: 1px solid transparent;
    background: var(--color-surface-tertiary);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    &:global(.brand) {
      background: var(--color-accent-subtle);
      color: var(--color-accent-primary);
    }

    &:global(.success) {
      background: var(--color-success-subtle);
      color: var(--color-success-primary);
    }

    &:global(.warning) {
      background: var(--color-warning-subtle);
      color: var(--color-warning-primary);
    }

    &:global(.danger) {
      background: var(--color-danger-subtle);
      color: var(--color-danger-primary);
    }

    &:global(.info) {
      background: var(--color-info-subtle);
      color: var(--color-info-primary);
    }
  }
</style>
