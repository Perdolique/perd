<template>
  <NuxtLink :to="to" :class="$style.component">
    <Icon
      :name="icon"
      :class="$style.icon"
      size="48px"
      aria-hidden="true"
    />

    <span :class="$style.label">{{ label }}</span>
  </NuxtLink>
</template>

<script lang="ts" setup>
  interface Props {
    icon: string;
    label: string;
    to: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    --quick-action-shadow-color: color-mix(in oklch, var(--color-forest-900) 9%, transparent);
    --quick-action-shadow-ambient-color: color-mix(in oklch, var(--color-forest-900) 7%, transparent);
    --quick-action-shadow:
      0 0 1.5rem -0.85rem var(--quick-action-shadow-ambient-color),
      0 0.85rem 1.5rem -1rem var(--quick-action-shadow-color);
    --quick-action-shadow-hover:
      0 0 1.75rem -0.75rem var(--quick-action-shadow-ambient-color),
      0 1rem 1.75rem -0.95rem var(--quick-action-shadow-color);

    display: grid;
    place-items: center;
    align-content: center;
    row-gap: var(--spacing-20);
    aspect-ratio: 1;
    min-block-size: 8rem;
    padding: var(--spacing-16);
    border-radius: var(--border-radius-20);
    outline: 2px solid transparent;
    outline-offset: var(--spacing-4);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--quick-action-shadow);
    text-align: center;
    text-decoration: none;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard),
      outline-color var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover {
      background: var(--color-background-elevated);
      box-shadow: var(--quick-action-shadow-hover);
    }

    &:focus-visible {
      outline-color: var(--color-focus-ring);
      background: var(--color-background-elevated);
      box-shadow: var(--quick-action-shadow-hover);
    }

    &:active {
      background: var(--color-accent-subtle);
    }
  }

  .icon {
    color: var(--color-accent-primary);
  }

  .label {
    font-size: var(--font-size-16);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-tight);
    overflow-wrap: anywhere;
  }
</style>
