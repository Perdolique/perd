<template>
  <div :class="$style.component">
    <ChecklistItem
      v-for="item in items"
      :key="item.id"
      :item="item"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { ChecklistItemModel } from '~/models/checklist';
  import ChecklistItem from './ChecklistItem.vue';

  interface Props {
    readonly items: ChecklistItemModel[];
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    width: 100%;
    display: grid;
    row-gap: var(--spacing-4);
  }
</style>
