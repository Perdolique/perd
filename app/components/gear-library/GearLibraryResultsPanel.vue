<template>
  <div :class="$style.component">
    <PagePlaceholder
      v-if="isOutOfRangePage"
      data-testid="gear-library-results-state"
      emoji="🗺️"
      full-width
      title="This page is out of range."
    >
      There are gear library items here, but this page number is no longer valid.

      <template #actions>
        <PerdButton variant="secondary" @click="emitGoLast">
          Go to last page
        </PerdButton>
      </template>
    </PagePlaceholder>

    <ul v-else :class="$style.list" role="list">
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
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import GearLibraryItemRow from '~/components/gear-library/GearLibraryItemRow.vue'

  interface Props {
    isOutOfRangePage: boolean;
    items: GearLibraryListItemView[];
  }

  type Emits = (event: 'go-last') => void

  defineProps<Props>()
  const emit = defineEmits<Emits>()

  function emitGoLast() {
    emit('go-last')
  }
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
