<template>
  <div :class="$style.component">
    <div>
      <p :class="$style.label">
        {{ label }}
      </p>

      <p :class="$style.value">
        {{ value }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    label: string;
    value: string;
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
    margin: 0 0 var(--spacing-8);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .value {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-semibold);
  }
</style>
