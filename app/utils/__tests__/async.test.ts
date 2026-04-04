import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { delay, withMinimumDelay } from '../async'

describe(withMinimumDelay, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('should return the resolved value of the promise', async () => {
    const promise = withMinimumDelay(Promise.resolve('hello'), 100)

    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toBe('hello')
  })

  test('should reject when the original promise rejects', async () => {
    const promise = withMinimumDelay(Promise.reject(new Error('boom')), 100)
    const assertion = expect(promise).rejects.toThrow('boom')

    await vi.advanceTimersByTimeAsync(100)

    await assertion
  })

  test('should wait for the minimum delay even if the promise resolves instantly', async () => {
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

  test('should not add extra delay when the promise takes longer than the timeout', async () => {
    async function slowTask() {
      await delay(500)
      return 'slow'
    }

    const promise = withMinimumDelay(slowTask(), 100)

    await vi.advanceTimersByTimeAsync(500)

    await expect(promise).resolves.toBe('slow')
  })

  test('should use default timeout of 250ms when not specified', async () => {
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
