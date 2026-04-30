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
        <PerdPill tone="neutral" role="status" aria-label="Loading page" aria-live="polite">
          <FidgetSpinner :class="$style.loadingSpinner" />
          Loading page
        </PerdPill>
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
  import PerdPill from '~/components/PerdPill.vue'
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

  .loadingSpinner {
    font-size: 1rem;
  }
</style>
