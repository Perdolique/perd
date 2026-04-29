<template>
  <div :class="$style.component">
    <PagePlaceholder v-if="isOutOfRangePage" emoji="🗺️" title="This page is out of range.">
      There are catalog items here, but this page number is no longer valid.

      <template #actions>
        <PerdButton variant="secondary" @click="emitGoLast">
          Go to last page
        </PerdButton>
      </template>
    </PagePlaceholder>

    <div
      v-else
      :class="$style.listShell"
      :aria-busy="ariaBusy"
    >
      <div v-if="showLoadingOverlay" :class="$style.loadingOverlay">
        <p :class="$style.loadingBadge" role="status" aria-label="Loading page" aria-live="polite">
          <FidgetSpinner :class="$style.loadingSpinner" />
          Loading page
        </p>
      </div>

      <div :class="$style.list">
        <CatalogItemRow
          v-for="item in items"
          :key="item.id"
          :item="item"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { CatalogListItemView } from '~/types/equipment'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import CatalogItemRow from '~/components/catalog/CatalogItemRow.vue'

  interface Props {
    isOutOfRangePage: boolean;
    items: CatalogListItemView[];
    showLoadingOverlay: boolean;
  }

  type Emits = (event: 'go-last') => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const ariaBusy = computed(() => props.showLoadingOverlay ? 'true' : 'false')

  function emitGoLast() {
    emit('go-last')
  }
</script>

<style module>
  .component {
    display: grid;
  }

  .listShell {
    position: relative;
    border-radius: var(--border-radius-24);
  }

  .list {
    display: grid;
    gap: var(--spacing-12);
  }

  .loadingOverlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background-color: color-mix(in oklch, var(--color-background-base), transparent 18%);
    backdrop-filter: blur(0.35rem);
    border-radius: inherit;
  }

  .loadingBadge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    margin: 0;
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-border-default);
    border-radius: 999px;
    background-color: color-mix(in oklch, var(--color-surface-base), transparent 8%);
    color: var(--color-text-primary);
  }

  .loadingSpinner {
    font-size: 1rem;
  }
</style>
