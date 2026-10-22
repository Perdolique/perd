import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { useRequestFetch } from '#imports'
import type { PackingListDetail, PackingListEntry } from '~/types/packing'
import { usePackingListsStore } from '../packing-lists'

const { fetchMock } = vi.hoisted(() => {
  return { fetchMock: vi.fn<(path: string, options?: unknown) => Promise<unknown>>() }
})

vi.mock(import('#imports'), () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The controlled transport covers multiple inferred Nitro response types.
  return { useRequestFetch: () => fetchMock as unknown as ReturnType<typeof useRequestFetch> }
})

const entry = {
  id: 'entry',
  source: 'custom',
  customName: 'Borrowed mug',
  isPacked: true,
  quantity: 1,
  weightGrams: null,
  weightSource: null,
  createdAt: '2026-10-17T10:00:00Z',
  updatedAt: '2026-10-17T10:00:00Z'
} as const satisfies PackingListEntry

const detail = {
  id: 'list',
  name: 'Trip',
  entries: [entry],
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
} satisfies PackingListDetail

const savedEntry = {
  ...entry,
  quantity: 3,
  weightGrams: '0',
  weightSource: 'custom',
  updatedAt: '2026-10-17T10:00:01Z'
} as const

const saved = {
  entry: savedEntry,
  packingListUpdatedAt: savedEntry.updatedAt
}

let pinia: ReturnType<typeof createPinia> | null = null

function settleLateEdit(fails: boolean, gate: ReturnType<typeof Promise.withResolvers<typeof saved>>) {
  if (fails) {
    gate.reject(new Error('late failure'))
  } else {
    gate.resolve(saved)
  }
}

describe('packing entry edit lifecycle', () => {
  beforeEach(() => {
    pinia = createPinia()

    setActivePinia(pinia)
    fetchMock.mockReset()
  })

  afterEach(() => {
    if (pinia !== null) {
      disposePinia(pinia)
    }

    setActivePinia(undefined)
  })

  it('keeps confirmed values until success, blocks concurrent row writes and list actions, and fences stale GETs', async () => {
    const store = usePackingListsStore()

    store.initializePackingListSummary(detail)

    const gate = Promise.withResolvers<typeof saved>()

    fetchMock.mockReturnValueOnce(gate.promise)

    const editing = store.editPackingListEntry(detail.id, entry.id, {
      quantity: 3,
      weightGrams: '0'
    })

    expect(store.getPackingListDetailView(detail).entries).toStrictEqual([entry])
    expect(store.isPackingListEntryOperationPending(detail.id, entry.id)).toBe(true)
    await expect(store.editPackingListEntry(detail.id, entry.id, { quantity: 4 })).rejects.toThrow('already pending')
    await expect(store.deletePackingListEntry(detail.id, entry.id, true)).rejects.toThrow('already pending')

    await expect(store.updatePackingListEntry({
      packingListId: detail.id,
      entryId: entry.id,
      isPacked: false,
      previousIsPacked: true
    })).rejects.toThrow('already pending')

    await expect(store.copyPackingList(detail.id, 'Copy')).rejects.toThrow('pending')
    await expect(store.clearPackingListPacked(detail.id)).rejects.toThrow('pending')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    gate.resolve(saved)
    await expect(editing).resolves.toStrictEqual(saved)
    store.initializePackingListSummary(detail)
    expect(store.getPackingListDetailView(detail).entries).toStrictEqual([savedEntry])
    expect(store.isPackingListMutationPending(detail.id)).toBe(false)

    const freshEntry = {
      ...savedEntry,
      quantity: 5,
      weightGrams: null,
      weightSource: null,
      updatedAt: '2026-10-17T10:00:02Z'
    }

    const fresh = {
      ...detail,
      entries: [freshEntry],
      updatedAt: freshEntry.updatedAt
    }

    store.initializePackingListSummary(fresh)
    expect(store.getPackingListDetailView(fresh).entries).toStrictEqual([freshEntry])
  })

  it('preserves the last confirmed values on failure and allows retry', async () => {
    const store = usePackingListsStore()

    store.initializePackingListSummary(detail)
    fetchMock.mockResolvedValueOnce(saved).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(saved)

    await store.editPackingListEntry(detail.id, entry.id, {
      quantity: 3,
      weightGrams: '0'
    })

    await expect(store.editPackingListEntry(detail.id, entry.id, { quantity: 4 })).rejects.toThrow('offline')
    expect(store.getPackingListDetailView(detail).entries).toStrictEqual([savedEntry])
    expect(store.isPackingListMutationPending(detail.id)).toBe(false)
    await expect(store.editPackingListEntry(detail.id, entry.id, { quantity: 3 })).resolves.toStrictEqual(saved)
  })

  it('keeps a confirmed packed change while editing against an older GET and restores it when the edit fails', async () => {
    const store = usePackingListsStore()

    const unpacked = {
      ...detail,

      entries: [{
        ...entry,
        isPacked: false
      }]
    }

    store.initializePackingListSummary(unpacked)

    fetchMock.mockResolvedValueOnce({
      entry: {
        ...savedEntry,
        quantity: 1,
        weightGrams: null,
        weightSource: null
      },

      packingListUpdatedAt: savedEntry.updatedAt
    })

    await store.updatePackingListEntry({
      packingListId: detail.id,
      entryId: entry.id,
      isPacked: true,
      previousIsPacked: false
    })

    const gate = Promise.withResolvers<typeof saved>()

    fetchMock.mockReturnValueOnce(gate.promise)

    const editing = store.editPackingListEntry(detail.id, entry.id, { quantity: 3 })

    expect(store.getPackingListDetailView(unpacked).entries[0]?.isPacked).toBe(true)
    gate.reject(new Error('offline'))
    await expect(editing).rejects.toThrow('offline')
    expect(store.getPackingListDetailView(unpacked).entries[0]?.isPacked).toBe(true)
  })

  it.each([false, true])('ignores a late edit after a session reset (failure: %s)', async (fails) => {
    const store = usePackingListsStore()
    const gate = Promise.withResolvers<typeof saved>()

    fetchMock.mockReturnValueOnce(gate.promise)

    const editing = store.editPackingListEntry(detail.id, entry.id, { quantity: 3 })

    store.clearPackingLists()
    settleLateEdit(fails, gate)
    await expect(editing).resolves.toBeNull()
    expect(store.getPackingListDetailView(detail).entries).toStrictEqual([entry])
    expect(store.isPackingListMutationPending(detail.id)).toBe(false)
  })

  it('protects quantity while allowing live My gear weight through stale list versions', async () => {
    const store = usePackingListsStore()

    const gearEntry = {
      ...entry,
      source: 'inventory',
      customName: null,
      quantity: 2,
      weightGrams: '10',
      weightSource: 'measured',

      inventory: {
        source: 'custom',
        inventoryId: 'private',
        itemName: 'Private stove'
      }
    } as const satisfies PackingListEntry

    fetchMock.mockResolvedValueOnce({
      entry: {
        ...gearEntry,
        updatedAt: savedEntry.updatedAt
      },

      packingListUpdatedAt: savedEntry.updatedAt
    })

    await store.editPackingListEntry(detail.id, entry.id, { quantity: 2 })

    const live = {
      ...gearEntry,
      quantity: 1,
      weightGrams: '12.345',
      weightSource: 'measured'
    } as const

    const view = store.getPackingListDetailView({
      ...detail,
      entries: [live]
    })

    expect(view.entries[0]).toMatchObject({
      quantity: 2,
      weightGrams: '12.345',
      weightSource: 'measured'
    })
  })
})
