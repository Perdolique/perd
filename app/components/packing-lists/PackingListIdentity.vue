<template>
  <div :class="$style.component">
    <span :class="$style.icon" aria-hidden="true">
      <Icon name="hugeicons:check-list" />
    </span>

    <div :class="$style.titleBlock">
      <div :class="$style.label">
        List
      </div>

      <h2 :class="[$style.title, 'packing-list-identity-title']">
        {{ name }}
      </h2>
    </div>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    name: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    min-inline-size: 0;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }
</style>
