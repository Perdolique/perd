import { nextTick, onMounted, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useRoute } from '#imports'

interface GearLibraryBrowsingState {
  desiredPageCount: number;
  left: number;
  path: string;
  top: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function takeSavedBrowsingState(path: string): GearLibraryBrowsingState | null {
  const historyState: unknown = globalThis.history.state

  if (isRecord(historyState) === false) {
    return null
  }

  const savedState = historyState.gearLibraryBrowsing
  const nextHistoryState = { ...historyState }

  Reflect.deleteProperty(nextHistoryState, 'gearLibraryBrowsing')
  globalThis.history.replaceState(nextHistoryState, '')

  if (isRecord(savedState) === false) {
    return null
  }

  const { desiredPageCount, left, path: savedPath, top } = savedState
  const hasValidState = savedPath === path
    && typeof desiredPageCount === 'number'
    && Number.isInteger(desiredPageCount)
    && desiredPageCount > 0
    && typeof left === 'number'
    && typeof top === 'number'

  if (hasValidState === false) {
    return null
  }

  return {
    desiredPageCount,
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
  const desiredPageCount = ref(savedBrowsingState?.desiredPageCount ?? 1)
  let hasHandledInitialScroll = false
  let isBrowsingStateReady: Readonly<Ref<boolean>> | null = null
  let isPageMounted = false
  let isRestoreScheduled = false

  function applyInitialScrollPosition() {
    isRestoreScheduled = false

    if (
      route.fullPath !== initialRoutePath
      || isBrowsingStateReady?.value !== true
    ) {
      hasHandledInitialScroll = true
      return
    }

    const left = savedBrowsingState?.left ?? 0
    const top = savedBrowsingState?.top ?? 0

    globalThis.scrollTo({ left, top })
    hasHandledInitialScroll = true
  }

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

  function connectBrowsingStateReady(state: Readonly<Ref<boolean>>) {
    isBrowsingStateReady = state

    watch(state, async () => {
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
      desiredPageCount: desiredPageCount.value,
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

    desiredPageCount.value = 1
    hasHandledInitialScroll = true
  })

  return {
    connectBrowsingStateReady,
    desiredPageCount
  }
}

export { useGearLibraryBrowsingRestoration }
