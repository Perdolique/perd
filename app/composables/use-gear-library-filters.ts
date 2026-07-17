import { computed, ref, watch, type ComputedRef } from 'vue'
import { limits } from '#shared/constants'
import type { GearLibraryRouteState } from '~/utils/gear-library'
import {
  createEmptyGearLibraryAppliedFilters,
  createEmptyGearLibraryFilterDraft,
  createGearLibraryFilterDraft,
  getGearLibraryAppliedFilterCount,
  getGearLibraryAppliedFilters,
  getGearLibraryNumberRangeErrors,
  normalizeGearLibraryFilterDraft,
  removeGearLibraryAppliedFilter,
  type GearLibraryAppliedFilter,
  type GearLibraryAppliedFilters
} from '~/utils/gear-library-filters'

interface UseGearLibraryFiltersOptions {
  handleFiltersChange: (filters: GearLibraryAppliedFilters) => Promise<void>;
  routeState: ComputedRef<GearLibraryRouteState>;
}

/** Owns editable filter state separately from the filters applied through the URL. */
function useGearLibraryFilters(options: UseGearLibraryFiltersOptions) {
  const appliedFilters = computed(() => getGearLibraryAppliedFilters(options.routeState.value))
  const appliedFiltersSignature = computed(() => JSON.stringify({
    category: options.routeState.value.category,
    filters: appliedFilters.value
  }))
  const draftFilters = ref(createGearLibraryFilterDraft(appliedFilters.value))
  const isFilterDialogOpen = ref(false)
  const numberRangeErrors = computed(() => getGearLibraryNumberRangeErrors(draftFilters.value))
  const hasNumberRangeErrors = computed(() => Object.keys(numberRangeErrors.value).length > 0)
  const appliedFilterCount = computed(() => getGearLibraryAppliedFilterCount(appliedFilters.value))
  const draftAppliedFilters = computed(() => normalizeGearLibraryFilterDraft(draftFilters.value))
  const draftFilterCount = computed(() => getGearLibraryAppliedFilterCount(draftAppliedFilters.value))
  const hasDraftFilters = computed(() => draftFilterCount.value > 0)
  const hasDraftChanges = computed(
    () => JSON.stringify(draftAppliedFilters.value) !== JSON.stringify(appliedFilters.value)
  )

  function resetDraftFilters() {
    draftFilters.value = createGearLibraryFilterDraft(appliedFilters.value)
  }

  function handleOpenFilters() {
    isFilterDialogOpen.value = true
  }

  function handleCancelFilters() {
    resetDraftFilters()
    isFilterDialogOpen.value = false
  }

  async function handleApplyFilters() {
    const filters = draftAppliedFilters.value
    const propertyFilterCount = filters.boolean.length + filters.enum.length + filters.number.length
    const hasFilterLimitErrors = filters.brand.length > limits.maxEquipmentItemsFilterCount
      || propertyFilterCount > limits.maxEquipmentItemsFilterCount

    if (
      hasFilterLimitErrors
      || hasNumberRangeErrors.value
      || hasDraftChanges.value === false
    ) {
      return
    }

    await options.handleFiltersChange(draftAppliedFilters.value)

    isFilterDialogOpen.value = false
  }

  async function handleClearAppliedFilters() {
    draftFilters.value = createEmptyGearLibraryFilterDraft()

    const emptyFilters = createEmptyGearLibraryAppliedFilters()

    await options.handleFiltersChange(emptyFilters)

    isFilterDialogOpen.value = false
  }

  async function handleRemoveFilter(filter: GearLibraryAppliedFilter) {
    const nextFilters = removeGearLibraryAppliedFilter(appliedFilters.value, filter)

    await options.handleFiltersChange(nextFilters)
  }

  watch(appliedFiltersSignature, resetDraftFilters)

  watch(isFilterDialogOpen, (isOpen, wasOpen) => {
    if (isOpen === false && wasOpen) {
      resetDraftFilters()
    }
  })

  return {
    appliedFilterCount,
    appliedFilters,
    draftFilterCount,
    draftFilters,
    handleApplyFilters,
    handleCancelFilters,
    handleClearAppliedFilters,
    handleOpenFilters,
    handleRemoveFilter,
    hasDraftChanges,
    hasDraftFilters,
    hasNumberRangeErrors,
    isFilterDialogOpen,
    numberRangeErrors
  }
}

export { useGearLibraryFilters }
