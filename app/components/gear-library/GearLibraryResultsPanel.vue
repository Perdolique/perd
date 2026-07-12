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

    <div v-else :class="$style.listShell">
      <ul :class="$style.list">
        <GearLibraryItemRow
          v-for="item in items"
          :key="item.id"
          :item="item"
        />
      </ul>
    </div>
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

  .listShell {
    overflow: clip;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    background-color: var(--color-surface-primary);
  }

  .list {
    display: grid;
    padding: 0;
    list-style: none;
  }
</style>
