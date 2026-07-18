import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref
} from 'vue'

import { onBeforeRouteLeave } from 'vue-router'
import { useAsyncData, useRequestFetch } from '#imports'
import type { GearLibraryItemsResponse } from '~/types/equipment'

import {
  gearLibraryPageSize,
  getRestorableGearLibraryPages,
  getGearLibraryTotalPages,
  getUniqueGearLibraryItems,
  type GearLibraryItemsApiQuery
} from '~/utils/gear-library'

import { useGearLibraryCache } from '~/composables/use-gear-library-cache'

import {
  useGearLibraryPageLoader
} from '~/composables/use-gear-library-page-loader'

interface UseGearLibraryItemsDataOptions {
  hasSavedBrowsingState: boolean;
  loadedPageCount: Ref<number>;
  hasNarrowingState: ComputedRef<boolean>;
  itemsApiQuery: ComputedRef<GearLibraryItemsApiQuery>;
  itemsApiQuerySignature: ComputedRef<string>;
}

const emptyItemsResponse: GearLibraryItemsResponse = {
  items: [],
  limit: gearLibraryPageSize,
  page: 1,
  total: 0
}

/** Owns the catalog page prefix, retries, cancellation, and item-response cache. */
function useGearLibraryItemsData(options: UseGearLibraryItemsDataOptions) {
  const requestFetch = useRequestFetch()
  const { getItemsSnapshot, storeItemsSnapshot } = useGearLibraryCache()
  const initialSignature = options.itemsApiQuerySignature.value
  const initialItemsSnapshot = getItemsSnapshot(initialSignature)

  const restoredPages = options.hasSavedBrowsingState
    ? getRestorableGearLibraryPages(
        initialItemsSnapshot?.pages ?? [],
        options.loadedPageCount.value
      )
    : []

  const hasRestorableInitialSnapshot = restoredPages.length > 0

  const initialPages = hasRestorableInitialSnapshot
    ? restoredPages
    : initialItemsSnapshot?.pages.slice(0, 1) ?? []

  const initialItemsResponse = initialPages[0] ?? emptyItemsResponse
  const itemsPath = '/api/equipment/items' as const

  const itemsAsyncData = useAsyncData('gear-library-items', async (_nuxtApp, { signal }) => {
    const response = await requestFetch(itemsPath, {
      method: 'get',
      query: options.itemsApiQuery.value,
      signal
    })

    return response
  }, {
    default: () => initialItemsResponse,
    lazy: true
  })

  const {
    data: itemsResponse,
    error: itemsError,
    refresh: refreshItemsRequest,
    status: itemsStatus
  } = itemsAsyncData

  const hasSuccessfulItemsRequest = ref(initialPages.length > 0 || itemsStatus.value === 'success')
  const lastSuccessfulHasNarrowingState = ref(initialItemsSnapshot?.hasNarrowingState ?? false)
  const loadedPages = shallowRef<GearLibraryItemsResponse[]>(initialPages)
  const isBrowsingStateReady = ref(false)
  const canRestoreSavedBrowsingState = ref(hasRestorableInitialSnapshot)
  let activeItemsGeneration = 0
  let activeItemsSignature = initialSignature
  let activeHasNarrowingState = options.hasNarrowingState.value
  let shouldPreserveInitialSnapshot = hasRestorableInitialSnapshot

  const lastSuccessfulItemsResponse = computed<GearLibraryItemsResponse>(() => {
    const firstPage = loadedPages.value[0] ?? emptyItemsResponse
    const items = getUniqueGearLibraryItems(loadedPages.value)
    const page = Math.max(loadedPages.value.length, 1)

    return {
      items,
      page,
      limit: firstPage.limit,
      total: firstPage.total
    }
  })
  const currentLoadedPageCount = computed(() => loadedPages.value.length)
  const totalPages = computed(() => getGearLibraryTotalPages(lastSuccessfulItemsResponse.value))

  const canLoadMore = computed(() => {
    const hasResults = lastSuccessfulItemsResponse.value.total > 0

    return hasResults && currentLoadedPageCount.value < totalPages.value
  })

  function storeCurrentPages(signature: string, hasNarrowingState: boolean) {
    storeItemsSnapshot(signature, {
      hasNarrowingState,
      pages: [...loadedPages.value]
    })
  }

  function getAdditionalPageQuery(page: number): GearLibraryItemsApiQuery {
    const baseQuery = options.itemsApiQuery.value

    return {
      page,
      booleanFilter: baseQuery.booleanFilter,
      brandSlug: baseQuery.brandSlug,
      categorySlug: baseQuery.categorySlug,
      direction: baseQuery.direction,
      enumFilter: baseQuery.enumFilter,
      limit: baseQuery.limit,
      numberFilter: baseQuery.numberFilter,
      search: baseQuery.search,
      sort: baseQuery.sort
    }
  }

  function isCurrentItemsRequest(generation: number, signature: string) {
    return generation === activeItemsGeneration && signature === activeItemsSignature
  }

  async function fetchAdditionalPage(page: number, signal: globalThis.AbortSignal) {
    return requestFetch(itemsPath, {
      method: 'get',
      query: getAdditionalPageQuery(page),
      signal
    })
  }

  const {
    cancelRequest: cancelAdditionalRequest,
    hasLoadMoreError,
    isLoadingMore,
    loadPage,
    loadMoreAnnouncement,
    retryLoadMore
  } = useGearLibraryPageLoader({
    fetchPage: fetchAdditionalPage,
    getActiveRequest: () => {
      return {
        generation: activeItemsGeneration,
        hasNarrowingState: activeHasNarrowingState,
        signature: activeItemsSignature
      }
    },

    isCurrentRequest: isCurrentItemsRequest,
    loadedPageCount: options.loadedPageCount,
    loadedPages,
    storeCurrentPages
  })

  function cancelAdditionalRequests() {
    activeItemsGeneration += 1
    cancelAdditionalRequest()
  }

  function handleSuccessfulFirstPage() {
    const signature = activeItemsSignature
    const [cachedFirstPage] = loadedPages.value
    const shouldPreserveSnapshot = shouldPreserveInitialSnapshot && cachedFirstPage !== undefined
    const firstPage = shouldPreserveSnapshot ? cachedFirstPage : itemsResponse.value

    shouldPreserveInitialSnapshot = false
    hasSuccessfulItemsRequest.value = true
    lastSuccessfulHasNarrowingState.value = activeHasNarrowingState

    if (shouldPreserveSnapshot === false) {
      loadedPages.value = [firstPage]
      options.loadedPageCount.value = 1
    }

    storeCurrentPages(signature, activeHasNarrowingState)

    isBrowsingStateReady.value = true
  }

  async function refreshItems() {
    cancelAdditionalRequests()

    isBrowsingStateReady.value = false

    await refreshItemsRequest()
  }

  async function loadMore() {
    const canStartLoad = canLoadMore.value
      && isBrowsingStateReady.value
      && isLoadingMore.value === false
      && hasLoadMoreError.value === false

    if (canStartLoad === false) {
      return
    }

    const targetPageCount = loadedPages.value.length + 1

    await loadPage(targetPageCount)
  }

  watch(options.itemsApiQuerySignature, async (signature) => {
    activeItemsSignature = signature
    activeHasNarrowingState = options.hasNarrowingState.value

    cancelAdditionalRequests()

    options.loadedPageCount.value = 1
    isBrowsingStateReady.value = false
    canRestoreSavedBrowsingState.value = false
    loadMoreAnnouncement.value = ''
    shouldPreserveInitialSnapshot = false

    const cachedSnapshot = getItemsSnapshot(signature)

    if (cachedSnapshot !== undefined) {
      hasSuccessfulItemsRequest.value = true
      lastSuccessfulHasNarrowingState.value = cachedSnapshot.hasNarrowingState
      loadedPages.value = cachedSnapshot.pages.slice(0, 1)
    }

    await refreshItemsRequest()
  }, {
    flush: 'sync'
  })

  watch(itemsStatus, (status) => {
    if (status !== 'success') {
      return
    }

    handleSuccessfulFirstPage()
  }, {
    flush: 'sync',
    immediate: true
  })

  onBeforeRouteLeave(cancelAdditionalRequests)
  onScopeDispose(cancelAdditionalRequests)

  return {
    canLoadMore,
    canRestoreSavedBrowsingState,
    hasLoadMoreError,
    hasSuccessfulItemsRequest,
    isBrowsingStateReady,
    isLoadingMore,
    itemsError,
    itemsStatus,
    initialItemsRequest: itemsAsyncData,
    lastSuccessfulHasNarrowingState,
    lastSuccessfulItemsResponse,
    loadMore,
    loadMoreAnnouncement,
    refreshItems,
    retryLoadMore
  }
}

export { useGearLibraryItemsData }
