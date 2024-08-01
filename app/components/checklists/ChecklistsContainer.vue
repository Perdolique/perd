<template>
  <div :class="$style.component">
    <ChecklistsItem
      v-for="{ id, name } in checklists"
      :key="id"
      :checklist-id="id"
      :checklist-name="name"
    />
  </div>
</template>

<script lang="ts" setup>
  import ChecklistsItem from './ChecklistsItem.vue';

  interface Props {
    readonly checklists: ChecklistModel[];
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-16);
  }
</style>
