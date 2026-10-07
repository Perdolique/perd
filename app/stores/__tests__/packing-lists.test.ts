import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { useRequestFetch } from '#imports'
import { usePackingListsStore } from '../packing-lists'

const { fetchMock } = vi.hoisted(() => {
  return { fetchMock: vi.fn<(path: string, options?: unknown) => Promise<unknown>>() }
})

vi.mock(import('#imports'), () => {
  // The controlled transport returns several route shapes; Nitro checks the production call sites.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Controlled mock responses cover several Nitro routes without recursively comparing every route generic.
  return { useRequestFetch: () => fetchMock as unknown as ReturnType<typeof useRequestFetch> }
})

const listId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

const copySummary = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
  name: 'Copy',
  createdAt: '2026-10-06T12:00:00Z',
  updatedAt: '2026-10-06T12:00:00Z',
  entryCount: 3,
  packedCount: 0
}

let pinia: ReturnType<typeof createPinia> | null = null

function settleCopy(fail: boolean, resolve: (value: typeof copySummary) => void, reject: (error: Error) => void) {
  if (fail) {
    const failure = new Error('Late failure')

    reject(failure)
  } else {
    resolve(copySummary)
  }
}

describe('packing list copy lifecycle', () => {
  beforeEach(() => {
    pinia = createPinia()

    setActivePinia(pinia)
    fetchMock.mockReset()

    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {
      // Expected transport failures are checked through store state.
    })
  })

  afterEach(() => {
    if (pinia !== null) {
      disposePinia(pinia)
    }

    setActivePinia(undefined)
    vi.restoreAllMocks()
  })

  it('locks duplicate copies and original writes, then keeps confirmed success when overview refresh fails', async () => {
    const store = usePackingListsStore()
    const { promise: response, resolve: resolveCopy } = Promise.withResolvers<typeof copySummary>()
    const refreshFailure = new Error('Overview unavailable')

    fetchMock.mockReturnValueOnce(response).mockRejectedValueOnce(refreshFailure)

    const copying = store.copyPackingList(listId, 'Copy')

    expect(store.isPackingListCopying(listId)).toBe(true)
    await expect(store.copyPackingList(listId, 'Duplicate')).rejects.toThrow('being copied')
    await expect(store.renamePackingList(listId, 'Rename')).rejects.toThrow('being copied')
    await expect(store.deletePackingList(listId)).rejects.toThrow('being copied')
    await expect(store.createPackingListEntry(listId, { customName: 'Late item' })).rejects.toThrow('being copied')

    await expect(store.updatePackingListEntry({
      packingListId: listId,
      entryId: 'entry',
      isPacked: true,
      previousIsPacked: false
    })).rejects.toThrow('being copied')

    await expect(store.deletePackingListEntry(listId, 'entry', false)).rejects.toThrow('being copied')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveCopy(copySummary)
    await expect(copying).resolves.toStrictEqual(copySummary)
    expect(store.rows).toStrictEqual([copySummary])
    expect(store.isPackingListCopying(listId)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/user/packing-lists')

    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/user/packing-lists/${listId}/copy`, {
      method: 'POST',
      body: { name: 'Copy' },
      retry: 0
    })
  })

  it('keeps one committed copy when an overview GET finishes before POST and exposes a failed refresh', async () => {
    const store = usePackingListsStore()
    const copyReply = Promise.withResolvers<typeof copySummary>()
    const refreshReply = Promise.withResolvers<typeof copySummary[]>()
    const packingReply = Promise.withResolvers<Awaited<ReturnType<typeof store.updatePackingListEntry>>>()

    const optimisticCopy = {
      ...copySummary,
      packedCount: 1
    }

    fetchMock.mockResolvedValueOnce([])
      .mockReturnValueOnce(copyReply.promise)
      .mockResolvedValueOnce([copySummary])
      .mockReturnValueOnce(packingReply.promise)
      .mockReturnValueOnce(refreshReply.promise)

    await store.fetchPackingLists()

    const copying = store.copyPackingList(listId, 'Copy')

    await store.fetchPackingLists()
    expect(store.rows).toStrictEqual([copySummary])

    const packing = store.updatePackingListEntry({
      entryId: 'entry',
      packingListId: copySummary.id,
      isPacked: true,
      previousIsPacked: false
    })

    expect(store.rows).toStrictEqual([optimisticCopy])
    copyReply.resolve(copySummary)
    await expect(copying).resolves.toStrictEqual(copySummary)
    expect(store.rows).toStrictEqual([optimisticCopy])
    expect(store.isPackingListMutationPending(copySummary.id)).toBe(true)
    expect(store.isRefreshing).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(5)

    packingReply.resolve({
      entry: {
        id: 'entry',
        customName: 'Jacket',
        source: 'custom',
        isPacked: true,
        createdAt: copySummary.createdAt,
        updatedAt: copySummary.updatedAt
      },

      packingListUpdatedAt: copySummary.updatedAt
    })

    await packing

    expect(store.isPackingListMutationPending(copySummary.id)).toBe(false)

    const failure = new Error('Overview unavailable')

    refreshReply.reject(failure)
    await expect.poll(() => store.hasRefreshError).toBe(true)
    expect(store.rows).toStrictEqual([optimisticCopy])
    expect(store.errorMessage).toBe('Could not refresh packing lists. The lists below may be out of date.')
    expect(globalThis.console.error).toHaveBeenCalledWith('Failed to load packing lists:', failure)
    expect(store.isRefreshing).toBe(false)
    fetchMock.mockResolvedValueOnce([optimisticCopy])
    await store.fetchPackingLists()
    expect(store.hasRefreshError).toBe(false)
    expect(store.errorMessage).toBeNull()
  })

  it('does not restore a copy deleted before its delayed POST response arrives', async () => {
    const store = usePackingListsStore()
    const reply = Promise.withResolvers<typeof copySummary>()
    const refreshFailure = new Error('Overview unavailable')

    fetchMock.mockReturnValueOnce(reply.promise)
      .mockResolvedValueOnce([copySummary])
      .mockImplementationOnce(async () => {
        // A successful DELETE has no response body.
      })
      .mockRejectedValueOnce(refreshFailure)
      .mockRejectedValueOnce(refreshFailure)

    const copying = store.copyPackingList(listId, 'Copy')

    await store.fetchPackingLists()
    await expect(store.deletePackingList(copySummary.id)).resolves.toBe(true)
    expect(store.rows).toStrictEqual([])
    reply.resolve(copySummary)
    await expect(copying).resolves.toStrictEqual(copySummary)
    expect(store.rows).toStrictEqual([])
    expect(store.isPackingListDeleted(copySummary.id)).toBe(true)
  })

  it('rejects copying while an original mutation is pending and unlocks after a known refusal', async () => {
    const store = usePackingListsStore()

    const original = {
      id: listId,
      name: 'Trip',
      entries: [],
      createdAt: copySummary.createdAt,
      updatedAt: copySummary.updatedAt
    }

    store.initializePackingListSummary(original)

    const { promise: response, resolve: resolveRename } = Promise.withResolvers<typeof original>()

    fetchMock.mockReturnValueOnce(response)

    const renaming = store.renamePackingList(listId, 'Renamed')

    await expect(store.copyPackingList(listId, 'Copy')).rejects.toThrow('still pending')
    resolveRename(original)

    await renaming

    const refusal = new Error('Known refusal')

    fetchMock.mockRejectedValueOnce(refusal)
    await expect(store.copyPackingList(listId, 'Copy')).rejects.toThrow('Known refusal')
    expect(store.isPackingListCopying(listId)).toBe(false)
    fetchMock.mockResolvedValueOnce(copySummary).mockResolvedValueOnce([copySummary])
    await expect(store.copyPackingList(listId, 'Copy')).resolves.toStrictEqual(copySummary)
  })

  it.each([
    {
      outcome: 'success',
      fail: false
    },
    {
      outcome: 'failure',
      fail: true
    }
  ])('ignores late copy $outcome after the account is reset', async ({ fail }) => {
    const store = usePackingListsStore()
    const { promise: response, resolve: resolveCopy, reject: rejectCopy } = Promise.withResolvers<typeof copySummary>()

    fetchMock.mockReturnValueOnce(response)

    const copying = store.copyPackingList(listId, 'Copy')

    store.clearPackingLists()
    settleCopy(fail, resolveCopy, rejectCopy)
    await expect(copying).resolves.toBeNull()
    expect(store.rows).toStrictEqual([])
    expect(store.hasLoaded).toBe(false)
    expect(store.isPackingListCopying(listId)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
