<template>
  <div :class="$style.component">
    <ul :class="$style.list" role="list">
      <GearLibraryItemRow
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </ul>
  </div>
</template>

<script lang="ts" setup>
  import type { GearLibraryListItemView } from '~/types/equipment'
  import GearLibraryItemRow from '~/components/gear-library/GearLibraryItemRow.vue'

  interface Props {
    items: GearLibraryListItemView[];
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
  }

  .list {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    list-style: none;
  }
</style>
