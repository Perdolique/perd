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
  import ChecklistItem from './ChecklistItem.vue';

  const { items } = useChecklistStore();
</script>

<style module>
  .component {
    width: 100%;
    display: grid;
    row-gap: var(--spacing-4);
  }
</style>
