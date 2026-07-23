import { computed, ref, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { navigateTo, useRoute } from '#imports'
import type { GearLibraryAppliedFilters } from '~/utils/gear-library-filters'

import {
  buildGearLibraryRouteQuery,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  type GearLibraryDirection,
  type GearLibraryOrdering,
  type GearLibraryRouteState,
  type GearLibrarySort
} from '~/utils/gear-library'
import { normalizeGearLibraryComparisonQuery } from '~/utils/gear-library-comparison'

interface GearLibraryRouteStateChanges {
  boolean?: string[];
  brand?: string[];
  category?: string | null;
  compare?: string[];
  direction?: GearLibraryDirection;
  enum?: string[];
  number?: string[];
  q?: string;
  sort?: GearLibrarySort;
}

/** Owns catalog URL writes and the stable first-page API query. */
function useGearLibraryRoute() {
  const route = useRoute()
  const routeState = computed(() => getGearLibraryRouteState(route.query))
  const selectedCategory = computed(() => routeState.value.category)
  const selectedCategoryValue = computed(() => selectedCategory.value ?? '')
  const comparisonNormalization = computed(() => normalizeGearLibraryComparisonQuery(
    route.query.compare,
    selectedCategory.value
  ))
  const routeSearch = computed(() => routeState.value.q)
  const searchValue = ref(routeSearch.value)
  const itemsRequestRouteState = shallowRef<GearLibraryRouteState>(routeState.value)

  const itemsRequestSignature = computed(() => {
    const query = getGearLibraryItemsApiQuery(routeState.value, 1)

    return JSON.stringify(query)
  })

  const itemsApiQuery = computed(() => getGearLibraryItemsApiQuery(
    itemsRequestRouteState.value,
    1
  ))

  const itemsApiQuerySignature = computed(() => JSON.stringify(itemsApiQuery.value))

  function createNextRouteState(changes: GearLibraryRouteStateChanges): GearLibraryRouteState {
    const currentState = routeState.value
    const hasCategoryChange = changes.category !== undefined
    const changedCategory = changes.category === null ? undefined : changes.category
    const category = hasCategoryChange ? changedCategory : currentState.category

    return {
      category,
      q: changes.q ?? currentState.q,
      brand: changes.brand ?? currentState.brand,
      number: hasCategoryChange ? [] : changes.number ?? currentState.number,
      enum: hasCategoryChange ? [] : changes.enum ?? currentState.enum,
      boolean: hasCategoryChange ? [] : changes.boolean ?? currentState.boolean,
      sort: hasCategoryChange ? 'name' : changes.sort ?? currentState.sort,
      direction: hasCategoryChange ? 'asc' : changes.direction ?? currentState.direction,
      compare: hasCategoryChange ? [] : changes.compare ?? currentState.compare
    }
  }

  async function writeRouteState(nextState: GearLibraryRouteState, replace: boolean) {
    const query = buildGearLibraryRouteQuery(nextState)

    const destination = {
      path: route.path,
      query
    }

    await navigateTo(destination, { replace })
  }

  async function handleSearchChange(value: string) {
    const normalizedSearch = value.trim()
    const currentSearch = routeState.value.q

    if (normalizedSearch === currentSearch) {
      return
    }

    const nextState = createNextRouteState({ q: normalizedSearch })

    await writeRouteState(nextState, true)
  }

  async function handleCategoryChange(value: string, replace = false) {
    const category = value === '' ? null : value
    const normalizedCategory = category ?? undefined

    if (normalizedCategory === routeState.value.category) {
      return
    }

    const nextState = createNextRouteState({ category })

    await writeRouteState(nextState, replace)
  }

  async function handleFiltersChange(filters: GearLibraryAppliedFilters) {
    const currentFilters = {
      boolean: routeState.value.boolean,
      brand: routeState.value.brand,
      enum: routeState.value.enum,
      number: routeState.value.number
    }

    if (JSON.stringify(filters) === JSON.stringify(currentFilters)) {
      return
    }

    const nextState = createNextRouteState(filters)

    await writeRouteState(nextState, false)
  }

  async function handleComparisonChange(compare: string[]) {
    const currentComparison = routeState.value.compare
    const hasSameComparison = JSON.stringify(compare) === JSON.stringify(currentComparison)

    if (hasSameComparison) {
      return
    }

    const nextState = createNextRouteState({ compare })

    await writeRouteState(nextState, true)
  }

  async function canonicalizeComparisonQuery() {
    const nextState = createNextRouteState({
      compare: comparisonNormalization.value.ids
    })

    await writeRouteState(nextState, true)
  }

  async function handleOrderingChange(ordering: GearLibraryOrdering, replace = false) {
    const currentState = routeState.value
    const hasSameSort = ordering.sort === currentState.sort
    const hasSameDirection = ordering.direction === currentState.direction

    if (hasSameSort && hasSameDirection) {
      return
    }

    const nextState = createNextRouteState({
      direction: ordering.direction,
      sort: ordering.sort
    })

    await writeRouteState(nextState, replace)
  }

  watch(itemsRequestSignature, () => {
    itemsRequestRouteState.value = routeState.value
  }, {
    flush: 'sync'
  })

  watch(routeSearch, (value) => {
    if (value === searchValue.value) {
      return
    }

    searchValue.value = value
  })

  watchDebounced(searchValue, handleSearchChange, {
    debounce: 250
  })

  return {
    canonicalizeComparisonQuery,
    comparisonNormalization,
    handleCategoryChange,
    handleComparisonChange,
    handleFiltersChange,
    handleOrderingChange,
    itemsApiQuery,
    itemsApiQuerySignature,
    routeState,
    searchValue,
    selectedCategory,
    selectedCategoryValue
  }
}

export { useGearLibraryRoute }
