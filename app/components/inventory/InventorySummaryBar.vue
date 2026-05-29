<template>
  <div :class="$style.component">
    <div>
      <p :class="$style.label">
        My gear
      </p>

      <p :class="$style.count">
        {{ summaryText }}
      </p>
    </div>

  </div>
</template>

<script lang="ts" setup>
  interface Props {
    summaryText: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-16);
    align-items: end;
  }

  .label {
    margin: 0;
    margin-bottom: var(--spacing-8);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .count {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-semibold);
  }
</style>
