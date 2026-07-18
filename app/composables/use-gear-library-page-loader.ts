import {
  nextTick,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef
} from 'vue'

import type { GearLibraryItemsResponse } from '~/types/equipment'
import { getUniqueGearLibraryItems } from '~/utils/gear-library'

interface ActiveGearLibraryItemsRequest {
  generation: number;
  hasNarrowingState: boolean;
  signature: string;
}

type FetchGearLibraryPage = (
  page: number,
  signal: globalThis.AbortSignal
) => Promise<GearLibraryItemsResponse>

interface UseGearLibraryPageLoaderOptions {
  fetchPage: FetchGearLibraryPage;
  getActiveRequest: () => ActiveGearLibraryItemsRequest;
  isCurrentRequest: (generation: number, signature: string) => boolean;
  loadedPageCount: Ref<number>;
  loadedPages: ShallowRef<GearLibraryItemsResponse[]>;
  storeCurrentPages: (signature: string, hasNarrowingState: boolean) => void;
}

/** Loads one explicitly requested catalog page and owns its retry state. */
function useGearLibraryPageLoader(options: UseGearLibraryPageLoaderOptions) {
  const hasLoadMoreError = ref(false)
  const isLoadingMore = ref(false)
  const loadMoreAnnouncement = ref('')
  const failedPage = shallowRef<number | null>(null)
  let requestController: globalThis.AbortController | null = null

  /** Cancels the active page request and clears its retry state. */
  function cancelRequest() {
    requestController?.abort()
    requestController = null
    isLoadingMore.value = false
    hasLoadMoreError.value = false
    failedPage.value = null
  }

  /** Announces appended items after Vue has flushed the updated results. */
  async function announceAppendedItems(
    itemCount: number,
    generation: number,
    signature: string
  ) {
    loadMoreAnnouncement.value = ''

    await nextTick()

    if (options.isCurrentRequest(generation, signature) === false) {
      return
    }

    const itemLabel = itemCount === 1 ? 'item' : 'items'

    loadMoreAnnouncement.value = `${itemCount} more ${itemLabel} loaded`
  }

  /** Loads exactly one page and records that same page for a possible retry. */
  async function loadPage(page: number) {
    const {
      generation,
      hasNarrowingState,
      signature
    } = options.getActiveRequest()

    const controller = new globalThis.AbortController()
    const itemCountBefore = getUniqueGearLibraryItems(options.loadedPages.value).length

    requestController = controller
    hasLoadMoreError.value = false
    isLoadingMore.value = true
    loadMoreAnnouncement.value = ''

    try {
      const response = await options.fetchPage(page, controller.signal)

      if (options.isCurrentRequest(generation, signature) === false) {
        return
      }

      if (response.page !== page) {
        throw new Error('Equipment items response page does not match the requested page')
      }

      options.loadedPages.value = [...options.loadedPages.value, response]
      options.loadedPageCount.value = options.loadedPages.value.length
      options.storeCurrentPages(signature, hasNarrowingState)
      failedPage.value = null

      const itemCountAfter = getUniqueGearLibraryItems(options.loadedPages.value).length

      await announceAppendedItems(itemCountAfter - itemCountBefore, generation, signature)
    } catch {
      if (options.isCurrentRequest(generation, signature) === false) {
        return
      }

      hasLoadMoreError.value = true
      failedPage.value = page
    } finally {
      if (requestController === controller) {
        requestController = null
        isLoadingMore.value = false
      }
    }
  }

  /** Retries only the single page that failed during the last explicit load. */
  async function retryLoadMore() {
    const page = failedPage.value

    if (page === null || isLoadingMore.value) {
      return
    }

    await loadPage(page)
  }

  return {
    cancelRequest,
    hasLoadMoreError,
    isLoadingMore,
    loadMoreAnnouncement,
    loadPage,
    retryLoadMore
  }
}

export {
  useGearLibraryPageLoader,
  type FetchGearLibraryPage
}
