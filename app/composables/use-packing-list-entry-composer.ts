import { computed, onScopeDispose, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useRequestFetch } from '#imports'
import type { PackingListAvailableGearItem, PackingListEntry } from '~/types/packing'

interface ComposerOptions {
  initiallyOpen: boolean;
  onCreated: (entry: PackingListEntry, packingListUpdatedAt: string) => void;
  packingListId: string;
}

interface ErrorWithStatus {
  status?: number;
  statusCode?: number;
}

export function usePackingListEntryComposer(options: ComposerOptions) {
  const requestFetch = useRequestFetch()
  const availableGearItems = ref<PackingListAvailableGearItem[]>([])
  const nextPage = ref<number | null>(null)
  const searchQuery = ref('')
  const isOpen = ref(options.initiallyOpen)
  const isInitialLoading = ref(false)
  const isLoadingMore = ref(false)
  const creatingInventoryId = ref<string | null>(null)
  const isCreatingCustomEntry = ref(false)
  const loadErrorMessage = ref<string | null>(null)
  const loadMoreErrorMessage = ref<string | null>(null)
  const mutationErrorMessage = ref<string | null>(null)
  const loadedSearch = ref<string | null>(null)
  let activeFetchController: AbortController | null = null
  let lastRequestedSearch: string | null = null

  const normalizedSearch = computed(() => searchQuery.value.trim())
  const hasAvailableItems = computed(() => availableGearItems.value.length > 0)
  const hasLoadError = computed(() => loadErrorMessage.value !== null)
  const hasLoadMoreError = computed(() => loadMoreErrorMessage.value !== null)
  const hasMutationError = computed(() => mutationErrorMessage.value !== null)
  const hasSearchQuery = computed(() => normalizedSearch.value !== '')
  const isCurrentSearchSettled = computed(() => loadedSearch.value === normalizedSearch.value)
  const isMutationPending = computed(() => creatingInventoryId.value !== null || isCreatingCustomEntry.value)
  const isReadPending = computed(() => isInitialLoading.value || isLoadingMore.value)
  const isResultActionDisabled = computed(() => isMutationPending.value || isReadPending.value)
  const ariaBusy = computed(() => isReadPending.value || undefined)
  const showCustomAction = computed(() => hasSearchQuery.value
    && isInitialLoading.value === false
    && isCurrentSearchSettled.value)
  const showEmptyMessage = computed(() => isInitialLoading.value === false
    && isCurrentSearchSettled.value
    && hasLoadError.value === false
    && hasAvailableItems.value === false)
  const emptyMessage = computed(() => {
    if (hasSearchQuery.value) {
      return 'No available My gear matches.'
    }

    return 'No available My gear items. Type a name to add a custom item.'
  })
  const customActionText = computed(() => `Add "${normalizedSearch.value}" as custom item`)
  const showLoadMore = computed(() => nextPage.value !== null && hasLoadError.value === false)

  function abortActiveFetch() {
    activeFetchController?.abort()
  }

  function getErrorStatus(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return
    }

    const errorWithStatus = error as ErrorWithStatus

    return errorWithStatus.statusCode ?? errorWithStatus.status
  }

  function resetReadState() {
    abortActiveFetch()

    activeFetchController = null
    availableGearItems.value = []
    nextPage.value = null
    isInitialLoading.value = false
    isLoadingMore.value = false
    loadErrorMessage.value = null
    loadMoreErrorMessage.value = null
    lastRequestedSearch = null
    loadedSearch.value = null
  }

  async function loadAvailableGear(page: number, replaceItems: boolean) {
    abortActiveFetch()

    const fetchController = new globalThis.AbortController()
    const querySearch = normalizedSearch.value

    activeFetchController = fetchController
    loadErrorMessage.value = null
    loadMoreErrorMessage.value = null

    if (replaceItems) {
      isInitialLoading.value = true
    } else {
      isLoadingMore.value = true
    }

    try {
      const response = await requestFetch(`/api/user/packing-lists/${options.packingListId}/available-gear`, {
        query: {
          page,
          search: querySearch
        },

        signal: fetchController.signal
      })

      if (fetchController.signal.aborted) {
        return
      }

      availableGearItems.value = replaceItems
        ? response.items
        : [
            ...availableGearItems.value,
            ...response.items
          ]

      nextPage.value = response.nextPage
      loadedSearch.value = querySearch
    } catch {
      if (fetchController.signal.aborted) {
        return
      }

      if (replaceItems) {
        loadErrorMessage.value = 'Could not load My gear.'
        loadedSearch.value = querySearch
      } else {
        loadMoreErrorMessage.value = 'Could not load more items.'
      }
    } finally {
      const isCurrentFetch = activeFetchController === fetchController

      if (isCurrentFetch) {
        activeFetchController = null
        isInitialLoading.value = false
        isLoadingMore.value = false
      }
    }
  }

  async function loadFirstPage(force = false) {
    const querySearch = normalizedSearch.value
    const isAlreadyRequested = querySearch === lastRequestedSearch
    const canReuseRequest = isAlreadyRequested && hasLoadError.value === false

    if (force === false && canReuseRequest) {
      return
    }

    lastRequestedSearch = querySearch
    availableGearItems.value = []
    nextPage.value = null

    await loadAvailableGear(1, true)
  }

  async function openComposer() {
    isOpen.value = true
    await loadFirstPage(true)
  }

  function closeComposer() {
    isOpen.value = false
    searchQuery.value = ''
    mutationErrorMessage.value = null
    resetReadState()
  }

  async function loadMore() {
    if (nextPage.value === null || isReadPending.value || isMutationPending.value) {
      return
    }

    await loadAvailableGear(nextPage.value, false)
  }

  async function applySuccessfulCreation(entry: PackingListEntry, packingListUpdatedAt: string) {
    options.onCreated(entry, packingListUpdatedAt)

    if (hasSearchQuery.value) {
      searchQuery.value = ''
    } else {
      await loadFirstPage(true)
    }

  }

  async function createInventoryEntry(item: PackingListAvailableGearItem) {
    if (isResultActionDisabled.value) {
      return false
    }

    mutationErrorMessage.value = null
    creatingInventoryId.value = item.inventoryId

    try {
      const response = await requestFetch(`/api/user/packing-lists/${options.packingListId}/entries`, {
        method: 'POST',

        body: {
          inventoryId: item.inventoryId
        }
      })

      await applySuccessfulCreation(response.entry, response.packingListUpdatedAt)

      return true
    } catch (error) {
      const errorStatus = getErrorStatus(error)

      mutationErrorMessage.value = errorStatus === 409
        ? 'This item is already in the list.'
        : 'Could not add item.'

      return false
    } finally {
      creatingInventoryId.value = null
    }
  }

  async function createCustomEntry() {
    if (isResultActionDisabled.value || showCustomAction.value === false) {
      return false
    }

    const customName = normalizedSearch.value

    mutationErrorMessage.value = null
    isCreatingCustomEntry.value = true

    try {
      const response = await requestFetch(`/api/user/packing-lists/${options.packingListId}/entries`, {
        method: 'POST',

        body: {
          customName
        }
      })

      await applySuccessfulCreation(response.entry, response.packingListUpdatedAt)

      return true
    } catch {
      mutationErrorMessage.value = 'Could not add custom item.'

      return false
    } finally {
      isCreatingCustomEntry.value = false
    }
  }

  watch(searchQuery, () => {
    abortActiveFetch()

    availableGearItems.value = []
    nextPage.value = null
    loadErrorMessage.value = null
    loadMoreErrorMessage.value = null
    mutationErrorMessage.value = null
    lastRequestedSearch = null
  }, {
    flush: 'sync'
  })

  watchDebounced(searchQuery, async () => {
    if (isOpen.value === false) {
      return
    }

    await loadFirstPage()
  }, {
    debounce: 250
  })

  onScopeDispose(() => {
    abortActiveFetch()
  })

  return {
    ariaBusy,
    availableGearItems,
    closeComposer,
    createCustomEntry,
    createInventoryEntry,
    creatingInventoryId,
    customActionText,
    emptyMessage,
    hasAvailableItems,
    hasLoadError,
    hasLoadMoreError,
    hasMutationError,
    isCreatingCustomEntry,
    isInitialLoading,
    isLoadingMore,
    isMutationPending,
    isOpen,
    isResultActionDisabled,
    loadErrorMessage,
    loadFirstPage,
    loadMore,
    loadMoreErrorMessage,
    mutationErrorMessage,
    normalizedSearch,
    openComposer,
    searchQuery,
    showCustomAction,
    showEmptyMessage,
    showLoadMore
  }
}
