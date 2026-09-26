<template>
  <ActionPanel
    :to="packingListPath"
    icon="hugeicons:check-list"
    :title="packingList.name"
  >
    <template #subtitle>
      <span role="status" aria-live="polite" aria-atomic="true">
        {{ packingProgressText }}
      </span>
    </template>

    <template #trailing>
      <span :class="$style.updatedMeta">
        <span :class="$style.updatedLabel">
          Updated
        </span>

        <time :datetime="packingList.updatedAt" :class="$style.updatedValue">
          {{ packingList.formattedUpdatedAt }}
        </time>
      </span>
    </template>
  </ActionPanel>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListView } from '~/types/packing'
  import { createPackingListPath } from '~/utils/navigation'
  import { formatPackingProgress } from '~/utils/packing'
  import ActionPanel from '~/components/ActionPanel.vue'

  interface Props {
    packingList: PackingListView;
  }

  const { packingList } = defineProps<Props>()
  const packingListPath = computed(() => createPackingListPath(packingList.id))

  const packingProgressText = computed(() => formatPackingProgress(
    packingList.packedCount,
    packingList.entryCount
  ))
</script>

<style module>
  .updatedMeta {
    display: grid;
    justify-items: end;
    gap: var(--spacing-4);
    min-inline-size: max-content;
    text-align: end;
  }

  .updatedLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    line-height: var(--line-height-snug);
    text-transform: uppercase;
  }

  .updatedValue {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
  }
</style>
