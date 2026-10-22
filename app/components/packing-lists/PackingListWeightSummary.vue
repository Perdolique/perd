<template>
  <section
    :class="$style.component"
    aria-label="All planned gear weight"
    aria-live="polite"
    aria-atomic="true"
  >
    <p>All planned gear</p>
    <p :class="$style.value">{{ weightSummaryText }}</p>
    <p v-if="weightSummaryHint">{{ weightSummaryHint }}</p>
    <p>{{ unknownWeightText }}</p>
  </section>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListEntry } from '~/types/packing'
  import { calculatePackingListWeight, formatPackingListWeight } from '~/utils/packing'

  interface Props {
    entries: PackingListEntry[];
  }

  const { entries } = defineProps<Props>()
  const isEmpty = computed(() => entries.length === 0)
  const packingWeight = computed(() => calculatePackingListWeight(entries))
  const isWeightIncomplete = computed(() => packingWeight.value.knownEntryCount > 0 && packingWeight.value.unknownEntryCount > 0)

  const weightSummaryText = computed(() => {
    if (packingWeight.value.knownEntryCount === 0 && !isEmpty.value) {
      return 'Total weight: Unknown'
    }

    const label = isWeightIncomplete.value ? 'Known weight' : 'Total weight'
    const weight = formatPackingListWeight(packingWeight.value.knownWeightGrams)

    return `${label}: ${weight}`
  })

  const weightSummaryHint = computed(() => {
    if (isEmpty.value) {
      return 'No items'
    }

    return isWeightIncomplete.value ? 'Total is incomplete' : null
  })

  const unknownWeightText = computed(() => {
    const count = packingWeight.value.unknownEntryCount
    const entryLabel = count === 1 ? 'entry' : 'entries'

    return `Unknown weight: ${count} ${entryLabel}`
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    line-height: var(--line-height-snug);
  }

  .value {
    color: var(--color-text-primary);
    font-size: var(--font-size-16);
    font-weight: var(--font-weight-semibold);
    overflow-wrap: anywhere;
  }
</style>
