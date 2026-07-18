<template>
  <form
    :class="$style.component"
    :aria-labelledby="titleId"
    @submit.prevent="emit('apply')"
  >
    <div :class="$style.header">
      <div :class="$style.titleBlock">
        <h2
          :id="titleId"
          :class="$style.title"
          autofocus
          tabindex="-1"
        >
          Filters
        </h2>

        <div :class="$style.filterSummary">
          <PerdPill
            v-if="filterLimitMessage"
            :role="filterLimitRole"
            :tone="filterLimitTone"
          >
            {{ filterLimitMessage }}
          </PerdPill>

          <span v-else :class="$style.draftCount">
            {{ draftFilterCountLabel }}
          </span>
        </div>
      </div>

      <PerdIconButton
        :class="$style.closeButton"
        icon="hugeicons:cancel-01"
        label="Close filters"
        @click="emit('cancel')"
      />
    </div>

    <div :class="$style.fields">
      <GearLibraryBrandFilterField
        v-model="brandFilters"
        v-model:search-value="brandSearchValue"
        v-model:is-expanded="isBrandListExpanded"
        :brands="brands"
        :is-limit-reached="filterLimitState.isBrandFilterLimitReached"
        :is-pending="isBrandsPending"
        :is-unavailable="hasBrandsUnavailable"
        @retry="emit('retry-brands')"
      />

      <template v-if="hasSelectedCategory">
        <p v-if="isPropertiesPending" :class="$style.status" role="status">
          Loading category filters…
        </p>

        <div v-else-if="hasPropertiesUnavailable" :class="$style.alert" role="alert">
          <span>Category filters unavailable.</span>

          <PerdButton size="small" variant="secondary" @click="emit('retry-properties')">
            Retry
          </PerdButton>
        </div>

        <template v-else>
          <GearLibraryNumberFilterFields
            v-model="numberFilters"
            :errors="numberRangeErrors"
            :is-limit-reached="filterLimitState.isPropertyFilterLimitReached"
            :properties="properties"
          />

          <GearLibraryEnumFilterFields
            v-model="enumFilters"
            :is-limit-reached="filterLimitState.isPropertyFilterLimitReached"
            :properties="properties"
          />

          <GearLibraryBooleanFilterFields
            v-model="booleanFilters"
            :is-limit-reached="filterLimitState.isPropertyFilterLimitReached"
            :properties="properties"
          />
        </template>
      </template>
    </div>

    <div :class="$style.actions">
      <PerdButton
        block
        type="submit"
        :disabled="isApplyDisabled"
      >
        Apply filters
      </PerdButton>

      <PerdButton
        block
        variant="secondary"
        :disabled="isClearDisabled"
        @click="emit('clear')"
      >
        Clear filters
      </PerdButton>
    </div>
  </form>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { limits } from '#shared/constants'
  import type { GearLibraryEntitySummary, GearLibraryFilterProperty } from '~/types/equipment'

  import {
    normalizeGearLibraryFilterDraft,
    type GearLibraryFilterDraft,
    type GearLibraryNumberRangeErrors
  } from '~/utils/gear-library-filters'

  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'
  import PerdPill from '~/components/PerdPill.vue'
  import GearLibraryBooleanFilterFields from './GearLibraryBooleanFilterFields.vue'
  import GearLibraryBrandFilterField from './GearLibraryBrandFilterField.vue'
  import GearLibraryEnumFilterFields from './GearLibraryEnumFilterFields.vue'
  import GearLibraryNumberFilterFields from './GearLibraryNumberFilterFields.vue'

  interface Props {
    brands: GearLibraryEntitySummary[];
    draftFilterCount: number;
    hasBrandsUnavailable: boolean;
    hasDraftChanges: boolean;
    hasDraftFilters: boolean;
    hasNumberRangeErrors: boolean;
    hasPropertiesUnavailable: boolean;
    hasSelectedCategory: boolean;
    isBrandsPending: boolean;
    isPropertiesPending: boolean;
    numberRangeErrors: GearLibraryNumberRangeErrors;
    properties: GearLibraryFilterProperty[];
    titleId: string;
  }

  type Emits = (event: 'apply' | 'cancel' | 'clear' | 'retry-brands' | 'retry-properties') => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const draftFilters = defineModel<GearLibraryFilterDraft>({ required: true })
  const brandSearchValue = defineModel<string>('brandSearchValue', { required: true })
  const isBrandListExpanded = defineModel<boolean>('isBrandListExpanded', { required: true })
  const maximumFilterCount = limits.maxEquipmentItemsFilterCount

  const brandFilters = computed({
    get: () => draftFilters.value.brand,

    set: (brand: string[]) => {
      draftFilters.value = {
        ...draftFilters.value,
        brand
      }
    }
  })

  const numberFilters = computed({
    get: () => draftFilters.value.number,

    set: (number: GearLibraryFilterDraft['number']) => {
      draftFilters.value = {
        ...draftFilters.value,
        number
      }
    }
  })

  const enumFilters = computed({
    get: () => draftFilters.value.enum,

    set: (enumFiltersValue: GearLibraryFilterDraft['enum']) => {
      draftFilters.value = {
        ...draftFilters.value,
        enum: enumFiltersValue
      }
    }
  })

  const booleanFilters = computed({
    get: () => draftFilters.value.boolean,

    set: (boolean: GearLibraryFilterDraft['boolean']) => {
      draftFilters.value = {
        ...draftFilters.value,
        boolean
      }
    }
  })
  const filterLimitState = computed(() => {
    const filters = normalizeGearLibraryFilterDraft(draftFilters.value)
    const brandFilterCount = filters.brand.length
    const propertyFilterCount = filters.boolean.length + filters.enum.length + filters.number.length
    const hasBrandFilterLimitError = brandFilterCount > maximumFilterCount
    const hasPropertyFilterLimitError = propertyFilterCount > maximumFilterCount

    return {
      hasBrandFilterLimitError,
      hasPropertyFilterLimitError,
      hasFilterLimitErrors: hasBrandFilterLimitError || hasPropertyFilterLimitError,
      isBrandFilterLimitReached: brandFilterCount >= maximumFilterCount,
      isPropertyFilterLimitReached: propertyFilterCount >= maximumFilterCount
    }
  })
  const filterLimitMessage = computed(() => {
    const state = filterLimitState.value

    if (state.hasBrandFilterLimitError && state.hasPropertyFilterLimitError) {
      return `Select no more than ${maximumFilterCount} brands and ${maximumFilterCount} property filters.`
    }

    if (state.hasBrandFilterLimitError) {
      return `Select no more than ${maximumFilterCount} brands.`
    }

    if (state.hasPropertyFilterLimitError) {
      return `Select no more than ${maximumFilterCount} property filters.`
    }

    if (state.isBrandFilterLimitReached && state.isPropertyFilterLimitReached) {
      return 'Brand and property filter limits reached.'
    }

    if (state.isBrandFilterLimitReached) {
      return `Limit of ${maximumFilterCount} brands reached. Deselect one to choose another.`
    }

    if (state.isPropertyFilterLimitReached) {
      return `Limit of ${maximumFilterCount} property filters reached. Remove one to add another.`
    }

    return null
  })

  const filterLimitRole = computed(() => filterLimitState.value.hasFilterLimitErrors ? 'alert' : 'status')
  const filterLimitTone = computed(() => filterLimitState.value.hasFilterLimitErrors ? 'danger' : 'warning')

  const isApplyDisabled = computed(
    () => filterLimitState.value.hasFilterLimitErrors || props.hasNumberRangeErrors || props.hasDraftChanges === false
  )

  const isClearDisabled = computed(() => props.hasDraftFilters === false && props.hasDraftChanges === false)

  const draftFilterCountLabel = computed(() => {
    const count = props.draftFilterCount

    return count === 1 ? '1 filter selected' : `${count} filters selected`
  })
</script>

<style module>
  .component {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: 100%;
    border-radius: inherit;
    background-color: var(--color-surface-primary);
  }

  .header {
    position: sticky;
    z-index: 2;
    inset-block-start: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-16) var(--spacing-20);
    border-block-end: 1px solid var(--color-border-subtle);
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
    background-color: var(--color-surface-primary);
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    font-size: var(--font-size-20);
  }

  .filterSummary {
    display: flex;
    align-items: center;
    block-size: 2.75rem;
  }

  .draftCount {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-regular);
  }

  .closeButton {
    flex: none;
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    border-radius: var(--border-radius-12);
  }

  .fields {
    display: grid;
    align-content: start;
    gap: var(--spacing-20);
    padding: var(--spacing-20);

    > [data-filter-field]:last-child {
      padding-block-end: 0;
      border-block-end: 0;
    }
  }

  .status {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
  }

  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-8) var(--spacing-12);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-12);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);
  }

  .actions {
    position: sticky;
    z-index: 2;
    inset-block-end: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-12);
    padding: var(--spacing-16) var(--spacing-20);
    border-end-start-radius: inherit;
    border-end-end-radius: inherit;
    background-color: var(--color-surface-primary);
  }
</style>
