import {
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter
} from 'vue'

import { useTimeoutFn } from '@vueuse/core'

interface DelayedPendingIndicatorOptions {
  delayMs: number;
  minimumVisibleMs: number;
}

/** Delays short-lived pending UI and owns its minimum visible lifetime. */
function useDelayedPendingIndicator(
  pending: MaybeRefOrGetter<boolean>,
  options: DelayedPendingIndicatorOptions
) {
  const isVisible = ref(false)
  let visibleSince = 0

  function showIndicator() {
    if (toValue(pending) === false) {
      return
    }

    visibleSince = Date.now()
    isVisible.value = true
  }

  function hideIndicator() {
    isVisible.value = false
  }

  const showTimeout = useTimeoutFn(showIndicator, options.delayMs, {
    immediate: false
  })

  const hideDelay = ref(0)

  const hideTimeout = useTimeoutFn(hideIndicator, hideDelay, {
    immediate: false
  })

  function handlePendingChange(isPending: boolean) {
    if (isPending) {
      hideTimeout.stop()

      if (isVisible.value || showTimeout.isPending.value) {
        return
      }

      showTimeout.start()
      return
    }

    showTimeout.stop()

    if (isVisible.value === false) {
      return
    }

    const visibleDuration = Date.now() - visibleSince
    const remainingDuration = Math.max(options.minimumVisibleMs - visibleDuration, 0)

    if (remainingDuration === 0) {
      hideIndicator()
      return
    }

    hideDelay.value = remainingDuration
    hideTimeout.start()
  }

  watch(
    () => toValue(pending),
    handlePendingChange,
    {
      flush: 'sync',
      immediate: true
    }
  )

  return readonly(isVisible)
}

export { useDelayedPendingIndicator }
