import { nextTick, onMounted, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useRoute } from '#imports'

interface GearLibraryBrowsingState {
  loadedPageCount: number;
  left: number;
  path: string;
  top: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Consumes and validates the browsing state stored in the current history entry. */
function takeSavedBrowsingState(path: string): GearLibraryBrowsingState | null {
  const historyState: unknown = globalThis.history.state

  if (isRecord(historyState) === false) {
    return null
  }

  const {
    gearLibraryBrowsing: savedState,
    ...nextHistoryState
  } = historyState

  globalThis.history.replaceState(nextHistoryState, '')

  if (isRecord(savedState) === false) {
    return null
  }

  const { loadedPageCount, left, path: savedPath, top } = savedState

  const hasValidState = savedPath === path
    && typeof loadedPageCount === 'number'
    && Number.isInteger(loadedPageCount)
    && loadedPageCount > 0
    && typeof left === 'number'
    && typeof top === 'number'

  if (hasValidState === false) {
    return null
  }

  return {
    loadedPageCount,
    left,
    path: savedPath,
    top
  }
}

/** Restores one catalog history entry without exposing browsing depth in its URL. */
function useGearLibraryBrowsingRestoration() {
  const route = useRoute()
  const initialRoutePath = route.fullPath

  const savedBrowsingState = import.meta.client
    ? takeSavedBrowsingState(initialRoutePath)
    : null

  const hasSavedBrowsingState = savedBrowsingState !== null
  const loadedPageCount = ref(savedBrowsingState?.loadedPageCount ?? 1)
  let hasHandledInitialScroll = false
  let isBrowsingStateReady: Readonly<Ref<boolean>> | null = null
  let canRestoreSavedBrowsingState: Readonly<Ref<boolean>> | null = null
  let isPageMounted = false
  let isRestoreScheduled = false

  /** Applies the saved scroll only when the complete matching page prefix came from cache. */
  function applyInitialScrollPosition() {
    isRestoreScheduled = false

    if (
      route.fullPath !== initialRoutePath
      || isBrowsingStateReady?.value !== true
    ) {
      hasHandledInitialScroll = true
      return
    }

    const shouldRestoreSavedScroll = savedBrowsingState !== null && canRestoreSavedBrowsingState?.value === true
    const left = shouldRestoreSavedScroll ? savedBrowsingState.left : 0
    const top = shouldRestoreSavedScroll ? savedBrowsingState.top : 0

    globalThis.scrollTo({ left, top })
    hasHandledInitialScroll = true
  }

  /** Schedules the initial scroll after the rendered item state is ready. */
  async function scheduleInitialScrollRestoration() {
    const canRestore = import.meta.client
      && isPageMounted
      && hasHandledInitialScroll === false
      && isRestoreScheduled === false
      && isBrowsingStateReady?.value === true

    if (canRestore === false) {
      return
    }

    isRestoreScheduled = true

    await nextTick()

    globalThis.requestAnimationFrame(applyInitialScrollPosition)
  }

  /** Connects item readiness and cache validation to one initial scroll decision. */
  function connectBrowsingState(
    readyState: Readonly<Ref<boolean>>,
    restorableState: Readonly<Ref<boolean>>
  ) {
    isBrowsingStateReady = readyState
    canRestoreSavedBrowsingState = restorableState

    watch([readyState, restorableState], async () => {
      await scheduleInitialScrollRestoration()
    })
  }

  onMounted(async () => {
    isPageMounted = true

    await scheduleInitialScrollRestoration()
  })

  onBeforeRouteLeave(() => {
    const historyState: unknown = globalThis.history.state
    const preservedHistoryState = isRecord(historyState) ? historyState : {}

    const gearLibraryBrowsing: GearLibraryBrowsingState = {
      loadedPageCount: loadedPageCount.value,
      left: globalThis.scrollX,
      path: route.fullPath,
      top: globalThis.scrollY
    }

    const nextHistoryState = {
      ...preservedHistoryState,
      gearLibraryBrowsing
    }

    globalThis.history.replaceState(nextHistoryState, '')
  })

  watch(() => route.fullPath, (fullPath) => {
    if (fullPath === initialRoutePath) {
      return
    }

    loadedPageCount.value = 1
    hasHandledInitialScroll = true
  })

  return {
    connectBrowsingState,
    hasSavedBrowsingState,
    loadedPageCount
  }
}

export { useGearLibraryBrowsingRestoration }
