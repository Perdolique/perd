import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDelayedPendingIndicator } from '../use-delayed-pending-indicator'

describe(useDelayedPendingIndicator, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should stay hidden when pending ends before the delay', () => {
    const pending = ref(false)
    const scope = effectScope()
    const isVisible = scope.run(() => useDelayedPendingIndicator(pending, {
      delayMs: 200,
      minimumVisibleMs: 300
    }))

    pending.value = true
    vi.advanceTimersByTime(199)
    pending.value = false
    vi.advanceTimersByTime(1)

    expect(isVisible?.value).toBe(false)

    scope.stop()
  })

  it('should keep a visible indicator for its minimum lifetime', () => {
    const pending = ref(true)
    const scope = effectScope()
    const isVisible = scope.run(() => useDelayedPendingIndicator(pending, {
      delayMs: 200,
      minimumVisibleMs: 300
    }))

    vi.advanceTimersByTime(200)
    expect(isVisible?.value).toBe(true)

    pending.value = false
    vi.advanceTimersByTime(299)
    expect(isVisible?.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(isVisible?.value).toBe(false)

    scope.stop()
  })

  it('should cancel a scheduled hide when pending starts again', () => {
    const pending = ref(true)
    const scope = effectScope()
    const isVisible = scope.run(() => useDelayedPendingIndicator(pending, {
      delayMs: 100,
      minimumVisibleMs: 300
    }))

    vi.advanceTimersByTime(100)
    pending.value = false
    vi.advanceTimersByTime(100)
    pending.value = true
    vi.advanceTimersByTime(200)

    expect(isVisible?.value).toBe(true)

    pending.value = false
    expect(isVisible?.value).toBe(false)

    scope.stop()
  })

  it('should clear its pending timers when the owning scope stops', () => {
    const pending = ref(true)
    const scope = effectScope()
    const isVisible = scope.run(() => useDelayedPendingIndicator(pending, {
      delayMs: 200,
      minimumVisibleMs: 300
    }))

    scope.stop()
    vi.advanceTimersByTime(200)

    expect(isVisible?.value).toBe(false)
  })
})
