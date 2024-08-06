<template>
  <div :class="$style.component">
    <div>
      {{ item.equipment.name}}
    </div>

    <div :class="$style.weight">
      {{ item.equipment.weight }}
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { ChecklistItemModel } from '~/models/checklist';

  interface Props {
    readonly item: ChecklistItemModel;
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: var(--border-radius-8) var(--spacing-12);
    background-color: var(--color-blue-100);
    border: 1px solid var(--color-blue-300);
    border-radius: var(--border-radius-12);
    font-size: var(--font-size-16);
    color: var(--color-blue-800);
  }

  .weight {
    color: var(--color-blue-700);
    font-size: var(--font-size-14);
  }
</style>
