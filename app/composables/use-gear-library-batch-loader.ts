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

interface PendingBatchRequest {
  targetPageCount: number;
  updateDesiredPageCountAfterSuccess: boolean;
}

interface GearLibraryBatchRestoration {
  desiredPageCount: number;
  generation: number;
  signature: string;
  targetPageCount: number;
}

interface UseGearLibraryBatchLoaderOptions {
  fetchPage: (
    page: number,
    signal: globalThis.AbortSignal
  ) => Promise<GearLibraryItemsResponse>;
  desiredPageCount: Ref<number>;
  getActiveRequest: () => ActiveGearLibraryItemsRequest;
  isBrowsingStateReady: Ref<boolean>;
  isCurrentRequest: (generation: number, signature: string) => boolean;
  loadedPages: ShallowRef<GearLibraryItemsResponse[]>;
  storeCurrentPages: (signature: string, hasNarrowingState: boolean) => void;
}

/** Loads the continuous item-page suffix and owns its retry and announcement state. */
function useGearLibraryBatchLoader(options: UseGearLibraryBatchLoaderOptions) {
  const hasLoadMoreError = ref(false)
  const isLoadingMore = ref(false)
  const loadMoreAnnouncement = ref('')
  const pendingBatchRequest = shallowRef<PendingBatchRequest | null>(null)
  let requestController: globalThis.AbortController | null = null

  function cancelRequest() {
    requestController?.abort()
    requestController = null
    isLoadingMore.value = false
    hasLoadMoreError.value = false
    pendingBatchRequest.value = null
  }

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

  async function loadAdditionalPages(
    targetPageCount: number,
    updateDesiredPageCountAfterSuccess: boolean,
    announceSuccess: boolean
  ) {
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
      for (let page = options.loadedPages.value.length + 1; page <= targetPageCount; page += 1) {
        // oxlint-disable-next-line no-await-in-loop -- The rendered result must remain a continuous page prefix.
        const response = await options.fetchPage(page, controller.signal)

        if (options.isCurrentRequest(generation, signature) === false) {
          return
        }

        if (response.page !== page) {
          throw new Error('Equipment items response page does not match the requested page')
        }

        options.loadedPages.value = [...options.loadedPages.value, response]
        options.storeCurrentPages(signature, hasNarrowingState)
      }

      pendingBatchRequest.value = null

      if (updateDesiredPageCountAfterSuccess) {
        options.desiredPageCount.value = options.loadedPages.value.length
      }

      if (announceSuccess) {
        const itemCountAfter = getUniqueGearLibraryItems(options.loadedPages.value).length

        await announceAppendedItems(itemCountAfter - itemCountBefore, generation, signature)

        if (options.isCurrentRequest(generation, signature) === false) {
          return
        }
      }

      options.isBrowsingStateReady.value = options.loadedPages.value.length >= targetPageCount
    } catch {
      if (options.isCurrentRequest(generation, signature) === false) {
        return
      }

      hasLoadMoreError.value = true
      options.isBrowsingStateReady.value = false
      pendingBatchRequest.value = {
        targetPageCount,
        updateDesiredPageCountAfterSuccess
      }
    } finally {
      if (requestController === controller) {
        requestController = null
        isLoadingMore.value = false
      }
    }
  }

  async function restoreBatch(restoration: GearLibraryBatchRestoration) {
    const {
      desiredPageCount,
      generation,
      signature,
      targetPageCount
    } = restoration
    const hasCurrentRequestedPageCount = options.desiredPageCount.value === desiredPageCount

    if (
      options.isCurrentRequest(generation, signature) === false
      || hasCurrentRequestedPageCount === false
    ) {
      return
    }

    if (targetPageCount !== desiredPageCount) {
      options.desiredPageCount.value = targetPageCount
    }

    if (options.loadedPages.value.length > targetPageCount) {
      const { hasNarrowingState } = options.getActiveRequest()

      options.loadedPages.value = options.loadedPages.value.slice(0, targetPageCount)
      options.storeCurrentPages(signature, hasNarrowingState)
    }

    if (options.loadedPages.value.length >= targetPageCount) {
      options.isBrowsingStateReady.value = true
      return
    }

    await loadAdditionalPages(targetPageCount, false, false)
  }

  async function retryLoadMore() {
    const pendingRequest = pendingBatchRequest.value

    if (pendingRequest === null || isLoadingMore.value) {
      return
    }

    await loadAdditionalPages(
      pendingRequest.targetPageCount,
      pendingRequest.updateDesiredPageCountAfterSuccess,
      true
    )
  }

  return {
    cancelRequest,
    hasLoadMoreError,
    isLoadingMore,
    loadAdditionalPages,
    loadMoreAnnouncement,
    restoreBatch,
    retryLoadMore
  }
}

export {
  useGearLibraryBatchLoader,
  type GearLibraryBatchRestoration
}
