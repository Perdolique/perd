<template>
  <div :class="$style.component">
    {{ name }}
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly id: string;
    readonly name: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    background-color: var(--accent-50);
    border: 1px solid var(--accent-200);
    border-radius: var(--border-radius-8);
    padding: var(--spacing-16);
    font-weight: var(--font-weight-medium);
  }
</style>
