<template>
  <div :class="[$style.component, statusClass]">
    {{ status }}
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly status: string;
  }

  const { status } = defineProps<Props>();

  const statusClass = computed(() => {
    switch (status) {
      case 'draft': {
        return 'draft';
      }

      case 'active': {
        return 'active';
      }
    }
  });
</script>

<style module>
  .component {
    display: inline-block;
    padding: var(--spacing-2) var(--spacing-8);
    color: var(--accent-600);
    font-size: var(--font-size-14);
    border: 1px solid var(--secondary-400);
    border-radius: var(--border-radius-8);
    text-transform: uppercase;
    background-color: var(--accent-50);

    &:global(.draft) {
      background-color: oklch(100% 0.1 75.83);
      border-color: oklch(90% 0.1 75.83);
      color: oklch(30% 0.1 75.83);

      @media (prefers-color-scheme: dark) {
        background-color: oklch(50% 0.1 75.83);
        border-color: oklch(60% 0.1 75.83);
        color: oklch(100% 0.1 75.83);
      }
    }

    &:global(.active) {
      background-color: oklch(100% 0.12 149.21);
      border-color: oklch(80% 0.12 149.21);
      color: oklch(20% 0.12 149.21);

      @media (prefers-color-scheme: dark) {
        background-color: oklch(50% 0.12 149.21);
        border-color: oklch(60% 0.12 149.21);
        color: oklch(100% 0.12 149.21);
      }
    }
  }
</style>
