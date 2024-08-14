<template>
  <div :class="$style.component">
    <ChecklistItem
      v-for="item in items"
      :key="item.id"
      :item="item"
      :check-mode="checkMode"
      :checklist-id="checklistId"
    />
  </div>
</template>

<script lang="ts" setup>
  import ChecklistItem from './ChecklistItem.vue';

  interface Props {
    readonly checkMode: boolean;
    readonly checklistId: string;
  }

  defineProps<Props>();

  const { items } = useChecklistStore();
</script>

<style module>
  .component {
    width: 100%;
    display: grid;
    row-gap: var(--spacing-4);
    background-color: var(--color-background);
  }
</style>
