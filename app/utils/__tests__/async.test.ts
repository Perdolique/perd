import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { delay, withMinimumDelay } from '../async'

async function slowTask() {
  await delay(500)
  return 'slow'
}

describe(withMinimumDelay, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should return the resolved value of the promise', async () => {
    const promise = withMinimumDelay(Promise.resolve('hello'), 100)

    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toBe('hello')
  })

  it('should reject when the original promise rejects', async () => {
    const promise = withMinimumDelay(Promise.reject(new Error('boom')), 100)

    await Promise.all([
      expect(promise).rejects.toThrow('boom'),
      vi.advanceTimersByTimeAsync(100)
    ])
  })

  it('should wait for the minimum delay even if the promise resolves instantly', async () => {
    let resolved = false
    const promise = withMinimumDelay(Promise.resolve('fast'), 500)

    void (async () => {
      await promise
      resolved = true
    })()

    await vi.advanceTimersByTimeAsync(200)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(300)
    expect(resolved).toBe(true)
  })

  it('should not add extra delay when the promise takes longer than the timeout', async () => {
    const promise = withMinimumDelay(slowTask(), 100)

    await vi.advanceTimersByTimeAsync(500)

    await expect(promise).resolves.toBe('slow')
  })

  it('should use default timeout of 250ms when not specified', async () => {
    let resolved = false
    const promise = withMinimumDelay(Promise.resolve('default'))

    void (async () => {
      await promise
      resolved = true
    })()

    await vi.advanceTimersByTimeAsync(200)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(50)
    expect(resolved).toBe(true)
  })
})
