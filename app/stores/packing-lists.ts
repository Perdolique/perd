import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRequestFetch } from '#imports'
import type { PackingListSummary } from '~/types/packing'

export const usePackingListsStore = defineStore('packing-lists', () => {
  const requestFetch = useRequestFetch()
  const rows = ref<PackingListSummary[]>([])
  const hasLoaded = ref(false)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  let activeFetchController: AbortController | null = null

  const hasUnavailableError = computed(() => errorMessage.value !== null && hasLoaded.value === false)
  const isEmpty = computed(() => rows.value.length === 0)
  const isInitialLoading = computed(() => loading.value && hasLoaded.value === false)

  function abortActiveFetch() {
    activeFetchController?.abort()
  }

  async function fetchPackingLists() {
    abortActiveFetch()

    const fetchController = new globalThis.AbortController()

    activeFetchController = fetchController
    loading.value = true

    try {
      const fetchedRows = await requestFetch('/api/user/packing-lists', {
        signal: fetchController.signal
      })

      rows.value = fetchedRows.map((row) => {
        return {
          createdAt: row.createdAt,
          entryCount: row.entryCount,
          id: row.id,
          name: row.name,
          updatedAt: row.updatedAt
        }
      })

      hasLoaded.value = true
      errorMessage.value = null
    } catch {
      const isFetchAborted = fetchController.signal.aborted

      if (isFetchAborted) {
        return
      }

      if (hasLoaded.value === false) {
        errorMessage.value = 'Could not load packing lists.'
      }
    } finally {
      const isCurrentFetch = activeFetchController === fetchController

      if (isCurrentFetch) {
        activeFetchController = null
        loading.value = false
      }
    }
  }

  async function createPackingList(name: string) {
    abortActiveFetch()

    const createdList = await requestFetch('/api/user/packing-lists', {
      method: 'POST',

      body: {
        name
      }
    })

    await fetchPackingLists()

    return createdList
  }

  function clearPackingLists() {
    abortActiveFetch()

    rows.value = []
    hasLoaded.value = false
    loading.value = false
    errorMessage.value = null
  }

  return {
    clearPackingLists,
    createPackingList,
    errorMessage,
    fetchPackingLists,
    hasLoaded,
    hasUnavailableError,
    isEmpty,
    isInitialLoading,
    loading,
    rows
  }
})
