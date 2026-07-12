import { computed, ref, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { navigateTo, useRoute } from '#imports'
import {
  buildGearLibraryRouteQuery,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  type GearLibraryDirection,
  type GearLibraryRouteState,
  type GearLibrarySort
} from '~/utils/gear-library'

interface GearLibraryRouteStateChanges {
  category?: string | null;
  direction?: GearLibraryDirection;
  q?: string;
  sort?: GearLibrarySort;
}

/** Owns catalog URL writes and the temporary local API page. */
function useGearLibraryRoute() {
  const route = useRoute()
  const currentPage = ref(1)
  const routeState = computed(() => getGearLibraryRouteState(route.query))
  const selectedCategory = computed(() => routeState.value.category)
  const selectedCategoryValue = computed(() => selectedCategory.value ?? '')
  const routeSearch = computed(() => routeState.value.q)
  const searchValue = ref(routeSearch.value)
  const itemsRequestRouteState = shallowRef<GearLibraryRouteState>(routeState.value)

  const itemsRequestSignature = computed(() => {
    const query = getGearLibraryItemsApiQuery(routeState.value, 1)

    return JSON.stringify(query)
  })

  const itemsApiQuery = computed(() => getGearLibraryItemsApiQuery(
    itemsRequestRouteState.value,
    currentPage.value
  ))

  const itemsApiQuerySignature = computed(() => JSON.stringify(itemsApiQuery.value))

  function createNextRouteState(changes: GearLibraryRouteStateChanges): GearLibraryRouteState {
    const currentState = routeState.value
    const hasCategoryChange = changes.category !== undefined
    const changedCategory = changes.category === null ? undefined : changes.category
    const category = hasCategoryChange ? changedCategory : currentState.category

    return {
      q: changes.q ?? currentState.q,
      category,
      brand: currentState.brand,
      number: currentState.number,
      enum: currentState.enum,
      boolean: currentState.boolean,
      sort: changes.sort ?? currentState.sort,
      direction: changes.direction ?? currentState.direction,
      batch: currentState.batch,
      compare: currentState.compare
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

  async function handleCategoryChange(value: string) {
    const category = value === '' ? null : value
    const normalizedCategory = category ?? undefined

    if (normalizedCategory === routeState.value.category) {
      return
    }

    const currentSort = routeState.value.sort
    const sort = currentSort.startsWith('property:') ? 'name' : currentSort
    const nextState = createNextRouteState({ category, sort })

    await writeRouteState(nextState, false)
  }

  async function handleSortChange(value: GearLibrarySort) {
    if (value === routeState.value.sort) {
      return
    }

    const nextState = createNextRouteState({ sort: value })

    await writeRouteState(nextState, false)
  }

  async function handleDirectionChange(value: GearLibraryDirection) {
    if (value === routeState.value.direction) {
      return
    }

    const nextState = createNextRouteState({ direction: value })

    await writeRouteState(nextState, false)
  }

  watch(itemsRequestSignature, () => {
    currentPage.value = 1
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
    currentPage,
    handleCategoryChange,
    handleDirectionChange,
    handleSortChange,
    itemsApiQuery,
    itemsApiQuerySignature,
    routeState,
    searchValue,
    selectedCategory,
    selectedCategoryValue
  }
}

export { useGearLibraryRoute }
