<template>
  <section
    v-if="hasEntries"
    :class="$style.component"
    aria-label="List weight"
    aria-live="polite"
    aria-atomic="true"
  >
    <p :class="$style.value">
      {{ weightDisplay.value }}
      <span v-if="weightDisplay.unit" :class="$style.unit">{{ weightDisplay.unit }}</span>
    </p>
    <p v-if="unknownWeightText" :class="$style.note">{{ unknownWeightText }}</p>
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
  const hasEntries = computed(() => entries.length > 0)
  const packingWeight = computed(() => calculatePackingListWeight(entries))

  const weightDisplay = computed(() => {
    if (packingWeight.value.knownEntryCount === 0) {
      return {
        value: 'Weight unknown',
        unit: null
      }
    }

    const formattedWeight = formatPackingListWeight(packingWeight.value.knownWeightGrams)
    const [value, unit] = formattedWeight.split(' ')

    return {
      value,
      unit
    }
  })

  const unknownWeightText = computed(() => {
    const count = packingWeight.value.unknownEntryCount

    if (count === 0) {
      return null
    }

    const itemLabel = count === 1 ? 'item' : 'items'

    return `${count} ${itemLabel} without weight`
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-inline-start: auto;
    line-height: var(--line-height-snug);
    text-align: end;
  }

  .value {
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .unit {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-regular);
  }

  .note {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
  }
</style>
