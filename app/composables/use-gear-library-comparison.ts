/* oxlint-disable max-lines -- Comparison restoration and mode state share one URL-backed lifecycle. */
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  watch,
  type ComputedRef
} from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { useAsyncData, useRequestFetch } from '#imports'
import type {
  GearLibraryComparisonSelectionItem,
  GearLibraryListItemView
} from '~/types/equipment'
import type { GearLibraryComparisonNormalization } from '~/utils/gear-library-comparison'

interface GearLibraryComparisonSummary {
  brandName: string;
  categorySlug: string;
  id: string;
  name: string;
}

interface GearLibraryComparisonRestoreResult {
  definitiveFailureIds: string[];
  signature: string;
  summaries: GearLibraryComparisonSummary[];
  transientFailureIds: string[];
}

interface ErrorWithStatus {
  status?: number;
  statusCode?: number;
}

interface UseGearLibraryComparisonOptions {
  canonicalizeComparisonQuery: () => Promise<void>;
  comparisonNormalization: ComputedRef<GearLibraryComparisonNormalization>;
  handleComparisonChange: (ids: string[]) => Promise<void>;
  items: ComputedRef<GearLibraryListItemView[]>;
  initiallyActive: boolean;
  selectedCategory: ComputedRef<string | undefined>;
  selectedIds: ComputedRef<string[]>;
}

const emptyRestoreResult: GearLibraryComparisonRestoreResult = {
  definitiveFailureIds: [],
  signature: '',
  summaries: [],
  transientFailureIds: []
}
const comparisonLimitAnnouncement = 'You can compare up to 4 items. Remove one to select another.'
const comparisonLimitAnnouncementDurationMs = 6000

function getErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return
  }

  const errorWithStatus = error as ErrorWithStatus

  return errorWithStatus.statusCode ?? errorWithStatus.status
}

function getComparisonAdjustmentMessage(
  normalization: GearLibraryComparisonNormalization
): string {
  if (normalization.wasClearedForMissingCategory) {
    return 'Comparison selection was cleared because no category is selected.'
  }

  const adjustments: string[] = []

  if (normalization.hasInvalidIds) {
    adjustments.push('invalid item IDs were removed')
  }

  if (normalization.hasDuplicateIds) {
    adjustments.push('duplicate item IDs were removed')
  }

  if (normalization.hasOverLimitIds) {
    adjustments.push('only the first 4 items were kept')
  }

  if (adjustments.length === 0) {
    return ''
  }

  return `Comparison selection was adjusted: ${adjustments.join('; ')}.`
}

/** Owns URL-backed catalog comparison selection and resilient summary restoration. */
function useGearLibraryComparison(options: UseGearLibraryComparisonOptions) {
  const requestFetch = useRequestFetch()
  const summaries = shallowRef(new Map<string, GearLibraryComparisonSummary>())
  const transientFailureIds = shallowRef(new Set<string>())
  const announcement = shallowRef('')
  const isModeActive = ref(options.initiallyActive || options.selectedIds.value.length > 0)
  const limitAnnouncement = shallowRef('')
  const limitAnnouncementTimeout = useTimeoutFn(() => {
    limitAnnouncement.value = ''
  }, comparisonLimitAnnouncementDurationMs, {
    immediate: false
  })

  function clearLimitAnnouncement() {
    limitAnnouncementTimeout.stop()
    limitAnnouncement.value = ''
  }

  function showLimitAnnouncement() {
    limitAnnouncementTimeout.stop()
    limitAnnouncement.value = comparisonLimitAnnouncement
    limitAnnouncementTimeout.start()
  }

  async function fetchComparisonSummary(
    id: string,
    signal: globalThis.AbortSignal
  ): Promise<GearLibraryComparisonSummary> {
    const itemDetailPath = `/api/equipment/items/${id}` as const
    const item = await requestFetch(itemDetailPath, {
      method: 'get',
      signal
    })

    return {
      brandName: item.brand.name,
      categorySlug: item.category.slug,
      id: item.id,
      name: item.name
    }
  }

  function seedVisibleSummaries(items: GearLibraryListItemView[]) {
    const selectedIdSet = new Set(options.selectedIds.value)
    const selectedCategory = options.selectedCategory.value
    const nextSummaries = new Map(summaries.value)
    let hasChanges = false

    for (const item of items) {
      const isSelectedItem = selectedIdSet.has(item.id)
      const isCurrentCategory = item.category.slug === selectedCategory

      if (isSelectedItem && isCurrentCategory && nextSummaries.has(item.id) === false) {
        nextSummaries.set(item.id, {
          brandName: item.brand.name,
          categorySlug: item.category.slug,
          id: item.id,
          name: item.name
        })
        hasChanges = true
      }
    }

    if (hasChanges) {
      summaries.value = nextSummaries
    }
  }

  seedVisibleSummaries(options.items.value)

  const selectedSignature = computed(() => JSON.stringify({
    category: options.selectedCategory.value,
    ids: options.selectedIds.value
  }))

  const restoreRequest = useAsyncData('gear-library-comparison-items', async (_nuxtApp, { signal }) => {
    const categorySlug = options.selectedCategory.value
    const selectedIds = options.selectedIds.value
    const missingIds = selectedIds.filter((id) => summaries.value.has(id) === false)
    const signature = selectedSignature.value
    const requests = missingIds.map(async (id) => {
      const summaryPromise = fetchComparisonSummary(id, signal)

      return summaryPromise
    })
    const results = await Promise.allSettled(requests)

    if (signal.aborted) {
      throw new globalThis.DOMException('Comparison restoration aborted', 'AbortError')
    }

    const definitiveFailureIds: string[] = []
    const restoredTransientFailureIds: string[] = []
    const restoredSummaries: GearLibraryComparisonSummary[] = []

    for (const [index, result] of results.entries()) {
      const id = missingIds[index]

      if (id !== undefined && result.status === 'rejected') {
        const status = getErrorStatus(result.reason)

        if (status === 404) {
          definitiveFailureIds.push(id)
        } else {
          restoredTransientFailureIds.push(id)
        }
      } else if (id !== undefined && result.status === 'fulfilled' && result.value.categorySlug !== categorySlug) {
        definitiveFailureIds.push(id)
      } else if (result.status === 'fulfilled') {
        restoredSummaries.push(result.value)
      }
    }

    return {
      definitiveFailureIds,
      signature,
      summaries: restoredSummaries,
      transientFailureIds: restoredTransientFailureIds
    }
  }, {
    default: () => emptyRestoreResult,
    lazy: true,
    watch: []
  })

  const {
    data: restoreResult,
    refresh: refreshRestoreRequest,
    status: restoreStatus
  } = restoreRequest

  const selectedItems = computed<GearLibraryComparisonSelectionItem[]>(() => (
    options.selectedIds.value.map((id) => {
      const summary = summaries.value.get(id)

      if (summary !== undefined) {
        return {
          brandName: summary.brandName,
          id,
          name: summary.name,
          status: 'resolved'
        }
      }

      const hasTransientFailure = transientFailureIds.value.has(id)

      return {
        id,
        status: hasTransientFailure ? 'error' : 'loading'
      }
    })
  ))

  const hasSelection = computed(() => options.selectedIds.value.length > 0)
  const hasRestoreErrors = computed(() => selectedItems.value.some((item) => item.status === 'error'))

  async function applyRestoreResult(result: GearLibraryComparisonRestoreResult) {
    const isCurrentResult = result.signature === selectedSignature.value

    if (isCurrentResult === false) {
      return
    }

    const nextSummaries = new Map(summaries.value)

    for (const summary of result.summaries) {
      nextSummaries.set(summary.id, summary)
    }

    summaries.value = nextSummaries
    transientFailureIds.value = new Set(result.transientFailureIds)

    if (result.definitiveFailureIds.length === 0) {
      return
    }

    const definitiveFailureIdSet = new Set(result.definitiveFailureIds)
    const remainingIds = options.selectedIds.value.filter((id) => definitiveFailureIdSet.has(id) === false)

    announcement.value = 'Some comparison items were removed because they are unavailable or belong to another category.'

    await options.handleComparisonChange(remainingIds)
  }

  async function addItem(item: GearLibraryListItemView) {
    const selectedIds = options.selectedIds.value
    const isAlreadySelected = selectedIds.includes(item.id)

    if (isAlreadySelected) {
      return
    }

    if (selectedIds.length === 4) {
      announcement.value = ''
      showLimitAnnouncement()

      return
    }

    announcement.value = ''
    clearLimitAnnouncement()
    seedVisibleSummaries([item])

    await options.handleComparisonChange([...selectedIds, item.id])
  }

  function enterMode() {
    announcement.value = ''
    clearLimitAnnouncement()
    isModeActive.value = true
  }

  async function exitMode() {
    announcement.value = ''
    clearLimitAnnouncement()
    transientFailureIds.value = new Set()
    isModeActive.value = false

    if (options.selectedIds.value.length > 0) {
      await options.handleComparisonChange([])
    }
  }

  async function removeItem(id: string) {
    const remainingIds = options.selectedIds.value.filter((selectedId) => selectedId !== id)

    announcement.value = ''
    clearLimitAnnouncement()
    await options.handleComparisonChange(remainingIds)
  }

  async function retryRestore() {
    transientFailureIds.value = new Set()

    await refreshRestoreRequest()
  }

  watch(options.items, seedVisibleSummaries)

  watch(options.selectedIds, (ids) => {
    if (ids.length > 0) {
      isModeActive.value = true
    }
  })

  watch(selectedSignature, async () => {
    clearLimitAnnouncement()
    transientFailureIds.value = new Set()

    await refreshRestoreRequest()
  }, {
    flush: 'sync'
  })

  watch(restoreStatus, async (status) => {
    if (status !== 'success') {
      return
    }

    await applyRestoreResult(restoreResult.value)
  }, {
    flush: 'sync',
    immediate: true
  })

  onMounted(async () => {
    const normalization = options.comparisonNormalization.value
    const adjustmentMessage = getComparisonAdjustmentMessage(normalization)

    if (adjustmentMessage === '') {
      return
    }

    announcement.value = adjustmentMessage

    if (normalization.wasClearedForMissingCategory) {
      isModeActive.value = false
    }

    await options.canonicalizeComparisonQuery()
  })

  return {
    addItem,
    announcement,
    enterMode,
    exitMode,
    hasRestoreErrors,
    hasSelection,
    isModeActive,
    limitAnnouncement,
    removeItem,
    restoreStatus,
    retryRestore,
    selectedItems
  }
}

export { useGearLibraryComparison }
