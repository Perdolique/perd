<template>
  <div :class="$style.component">
    <ul :class="$style.list" role="list">
      <GearLibraryItemRow
        v-for="resultItem in resultItems"
        :key="resultItem.item.id"
        :is-comparison-limit-reached="isComparisonLimitReached"
        :is-comparison-disabled="resultItem.isComparisonDisabled"
        :is-comparison-mode-active="isComparisonModeActive"
        :is-comparison-selected="resultItem.isComparisonSelected"
        :has-my-gear-error="resultItem.hasMyGearError"
        :is-in-my-gear="resultItem.isInMyGear"
        :is-my-gear-saving="resultItem.isMyGearSaving"
        :item="resultItem.item"
        @comparison-change="handleComparisonChange"
        @my-gear-add="handleMyGearAdd"
      />
    </ul>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { GearLibraryListItemView } from '~/types/equipment'
  import GearLibraryItemRow from '~/components/gear-library/GearLibraryItemRow.vue'

  interface Props {
    isComparisonLimitReached: boolean;
    isComparisonModeActive: boolean;
    items: GearLibraryListItemView[];
    myGearFailedItemIds: string[];
    myGearItemIds: string[];
    myGearSavingItemIds: string[];
    selectedCategory?: string;
    selectedComparisonIds: string[];
  }

  interface Emits {
    comparisonChange: [item: GearLibraryListItemView, selected: boolean];
    myGearAdd: [item: GearLibraryListItemView];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  function handleComparisonChange(item: GearLibraryListItemView, selected: boolean) {
    emit('comparisonChange', item, selected)
  }

  function handleMyGearAdd(item: GearLibraryListItemView) {
    emit('myGearAdd', item)
  }

  const resultItems = computed(() => {
    const failedMyGearIdSet = new Set(props.myGearFailedItemIds)
    const myGearIdSet = new Set(props.myGearItemIds)
    const savingMyGearIdSet = new Set(props.myGearSavingItemIds)
    const selectedIdSet = new Set(props.selectedComparisonIds)
    const { selectedCategory } = props
    const hasSelectedCategory = selectedCategory !== undefined
    const isComparisonDatasetReady = hasSelectedCategory
      && props.items.every((item) => item.category.slug === selectedCategory)

    return props.items.map((item) => {
      return {
        hasMyGearError: failedMyGearIdSet.has(item.id),
        isComparisonDisabled: isComparisonDatasetReady === false,
        isComparisonSelected: selectedIdSet.has(item.id),
        isInMyGear: myGearIdSet.has(item.id),
        isMyGearSaving: savingMyGearIdSet.has(item.id),
        item
      }
    })
  })
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
