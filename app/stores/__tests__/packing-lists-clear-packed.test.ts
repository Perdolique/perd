import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { useRequestFetch } from '#imports'
import type { PackingListDetail } from '~/types/packing'
import { usePackingListsStore } from '../packing-lists'

const { fetchMock } = vi.hoisted(() => {
  return { fetchMock: vi.fn<(path: string, options?: unknown) => Promise<unknown>>() }
})

vi.mock(import('#imports'), () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Nitro checks production routes; tests control several transport response shapes.
  return { useRequestFetch: () => fetchMock as unknown as ReturnType<typeof useRequestFetch> }
})

const originalEntry = {
  id: 'entry',
  source: 'custom',
  customName: 'Jacket',
  isPacked: true,
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z'
} as const

const original = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
  name: 'Trip',
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
  entries: [originalEntry]
} satisfies PackingListDetail

const cleared = {
  ...original,
  updatedAt: '2026-10-08T10:00:00.002Z',

  entries: [{
    ...originalEntry,
    isPacked: false,
    updatedAt: '2026-10-08T10:00:00.002Z'
  }]
} satisfies PackingListDetail

const summary = {
  id: original.id,
  name: original.name,
  createdAt: original.createdAt,
  updatedAt: original.updatedAt,
  entryCount: 1,
  packedCount: 1
}

let pinia: ReturnType<typeof createPinia> | null = null

function settleReset(outcome: 'success' | 'failure', reset: PromiseWithResolvers<PackingListDetail>) {
  if (outcome === 'success') {
    reset.resolve(cleared)
  } else {
    reset.reject(new Error('Late failure'))
  }
}

describe('clearing packed marks in the store', () => {
  beforeEach(() => {
    pinia = createPinia()

    setActivePinia(pinia)
    fetchMock.mockReset()

    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {
      // Error telemetry is checked without printing expected failures.
    })
  })

  afterEach(() => {
    if (pinia !== null) {
      disposePinia(pinia)
    }

    setActivePinia(undefined)
    vi.restoreAllMocks()
  })

  it('keeps marks while pending, blocks overlapping writes, and accepts the full response in detail and overview', async () => {
    const store = usePackingListsStore()
    const reset = Promise.withResolvers<PackingListDetail>()

    fetchMock.mockResolvedValueOnce([summary]).mockReturnValueOnce(reset.promise)
    await store.fetchPackingLists()
    store.initializePackingListSummary(original)

    const pending = store.clearPackingListPacked(original.id)

    expect(store.getPackingListDetailView(original)).toStrictEqual(original)
    expect(store.isPackingListMutationPending(original.id)).toBe(true)
    await expect(store.clearPackingListPacked(original.id)).rejects.toThrow('being cleared')
    await expect(store.renamePackingList(original.id, 'Rename')).rejects.toThrow('being cleared')
    await expect(store.copyPackingList(original.id, 'Copy')).rejects.toThrow('being cleared')
    await expect(store.deletePackingList(original.id)).rejects.toThrow('being cleared')
    await expect(store.createPackingListEntry(original.id, { customName: 'New' })).rejects.toThrow('being cleared')

    await expect(store.updatePackingListEntry({
      packingListId: original.id,
      entryId: 'entry',
      isPacked: false,
      previousIsPacked: true
    })).rejects.toThrow('being cleared')

    await expect(store.deletePackingListEntry(original.id, 'entry', true)).rejects.toThrow('being cleared')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    reset.resolve(cleared)
    await expect(pending).resolves.toStrictEqual(cleared)
    expect(store.getPackingListDetailView(original)).toStrictEqual(cleared)

    expect(store.rows).toStrictEqual([{
      ...summary,
      updatedAt: cleared.updatedAt,
      packedCount: 0
    }])

    expect(store.isPackingListMutationPending(original.id)).toBe(false)
    expect(store.canClearPackingListPacked(original.id)).toBe(false)

    expect(fetchMock).toHaveBeenLastCalledWith(`/api/user/packing-lists/${original.id}/clear-packed`, {
      method: 'POST',
      retry: 0
    })
  })

  it('rejects a reset while an entry save or rename is pending, even before overview loading', async () => {
    const store = usePackingListsStore()
    const save = Promise.withResolvers<unknown>()

    store.initializePackingListSummary(original)
    fetchMock.mockReturnValueOnce(save.promise)

    const renaming = store.renamePackingList(original.id, 'Renamed')

    await expect(store.clearPackingListPacked(original.id)).rejects.toThrow('changes are pending')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    save.resolve({
      ...summary,
      name: 'Renamed'
    })

    await renaming

    const packing = Promise.withResolvers<unknown>()

    fetchMock.mockReturnValueOnce(packing.promise)

    const updating = store.updatePackingListEntry({
      packingListId: original.id,
      entryId: 'entry',
      isPacked: true,
      previousIsPacked: true
    })

    await expect(store.clearPackingListPacked(original.id)).rejects.toThrow('changes are pending')

    packing.resolve({
      entry: originalEntry,
      packingListUpdatedAt: original.updatedAt
    })

    await updating
  })

  it('removes old entry overlays and rejects stale detail and overview replies until a current detail arrives', async () => {
    const store = usePackingListsStore()
    const oldOverview = Promise.withResolvers<unknown>()

    fetchMock.mockResolvedValueOnce([summary])
      .mockResolvedValueOnce({
        entry: originalEntry,
        packingListUpdatedAt: original.updatedAt
      })
      .mockReturnValueOnce(oldOverview.promise)
      .mockResolvedValueOnce(cleared)

    await store.fetchPackingLists()
    store.initializePackingListSummary(original)

    await store.updatePackingListEntry({
      packingListId: original.id,
      entryId: 'entry',
      isPacked: true,
      previousIsPacked: true
    })

    const fetching = store.fetchPackingLists()

    await store.clearPackingListPacked(original.id)
    oldOverview.resolve([summary])

    await fetching

    store.initializePackingListSummary(original)
    expect(store.getPackingListDetailView(original)).toStrictEqual(cleared)
    expect(store.rows[0]?.packedCount).toBe(0)

    // An old response from a GET started after POST must not replace the confirmed version either.
    fetchMock.mockResolvedValueOnce([summary])
    await store.fetchPackingLists()
    expect(store.rows[0]?.packedCount).toBe(0)

    const newer = {
      ...original,
      name: 'Other tab',
      updatedAt: '2026-10-08T10:00:00.003Z'
    }

    store.initializePackingListSummary(newer)
    expect(store.getPackingListDetailView(newer)).toStrictEqual(newer)
    expect(store.canClearPackingListPacked(original.id)).toBe(true)
  })

  it('re-reads a failed reset without claiming success and accepts the refreshed state', async () => {
    const store = usePackingListsStore()
    const failure = new Error('Transport disconnected')

    store.initializePackingListSummary(original)
    fetchMock.mockRejectedValueOnce(failure).mockResolvedValueOnce(cleared)
    await expect(store.clearPackingListPacked(original.id)).rejects.toBe(failure)
    expect(store.isPackingListPackedUnconfirmed(original.id)).toBe(false)
    expect(store.getPackingListDetailView(original)).toStrictEqual(cleared)
    expect(store.canClearPackingListPacked(original.id)).toBe(false)
    expect(globalThis.console.error).toHaveBeenCalledWith('Failed to clear packing list packed marks:', failure)
  })

  it('blocks further changes after a failed recovery until an explicit refresh succeeds', async () => {
    const store = usePackingListsStore()
    const failure = new Error('Transport disconnected')

    store.initializePackingListSummary(original)
    fetchMock.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)
    await expect(store.clearPackingListPacked(original.id)).rejects.toBe(failure)
    expect(store.isPackingListPackedUnconfirmed(original.id)).toBe(true)
    expect(store.getPackingListDetailView(original)).toStrictEqual(original)
    expect(store.canClearPackingListPacked(original.id)).toBe(false)
    await expect(store.createPackingListEntry(original.id, { customName: 'New' })).rejects.toThrow('needs refresh')
    fetchMock.mockResolvedValueOnce(cleared)
    await store.refreshPackingListPacked(original.id)
    expect(store.isPackingListPackedUnconfirmed(original.id)).toBe(false)
    expect(store.getPackingListDetailView(original)).toStrictEqual(cleared)
  })

  it.each(['success', 'failure'] as const)('ignores a late %s after account reset', async (outcome) => {
    const store = usePackingListsStore()
    const reset = Promise.withResolvers<PackingListDetail>()

    store.initializePackingListSummary(original)
    fetchMock.mockReturnValueOnce(reset.promise)

    const pending = store.clearPackingListPacked(original.id)

    store.clearPackingLists()
    settleReset(outcome, reset)
    await expect(pending).resolves.toBeNull()
    expect(store.rows).toStrictEqual([])
    expect(store.getPackingListDetailView(original)).toStrictEqual(original)
    expect(store.isPackingListMutationPending(original.id)).toBe(false)
    expect(store.isPackingListPackedUnconfirmed(original.id)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ignores recovery results after account reset', async () => {
    const store = usePackingListsStore()
    const reset = Promise.withResolvers<PackingListDetail>()
    const refresh = Promise.withResolvers<PackingListDetail>()

    store.initializePackingListSummary(original)
    fetchMock.mockReturnValueOnce(reset.promise).mockReturnValueOnce(refresh.promise)

    const pending = store.clearPackingListPacked(original.id)

    reset.reject(new Error('Lost response'))
    await expect.poll(() => fetchMock.mock.calls.length).toBe(2)
    store.clearPackingLists()
    refresh.resolve(cleared)
    await expect(pending).resolves.toBeNull()
    expect(store.rows).toStrictEqual([])
    expect(store.getPackingListDetailView(original)).toStrictEqual(original)
    expect(store.isPackingListMutationPending(original.id)).toBe(false)
    expect(store.isPackingListPackedUnconfirmed(original.id)).toBe(false)
  })
})
