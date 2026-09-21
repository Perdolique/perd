/* oxlint-disable max-lines -- Summary reconciliation and entry mutations share one reset and request lifecycle. */
import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRequestFetch } from '#imports'

import type {
  PackingListDetail,
  PackingListEntry,
  PackingListEntryCreateBody,
  PackingListEntryUpdateOptions,
  PackingListSummary
} from '~/types/packing'

import { countPackedEntries, latestPackingListUpdatedAt, normalizePackingListSummary } from '~/utils/packing'

interface PackingListSummaryState {
  pendingOperations: number;
  summary: PackingListSummary;
  version: number;
}

interface PackingListSummarySnapshot {
  pendingOperations: number;
  version: number;
}

interface PackingListSummaryOperation {
  generation: number;
  isTracked: boolean;
  packingListId: string;
}

interface PackingListEntryOperation {
  entryId: string;
  generation: number;
  isPacked: boolean | null;
  isPending: boolean;
  kind: 'delete' | 'update';
  operationId: number;
  packingListId: string;
  rollbackState: PackingListEntryRollbackState | null;
  updatedAt: string | null;
}

interface PackingListEntryRollbackState {
  isPacked: boolean;
  updatedAt: string;
}

interface PackingListEntryOperationOptions {
  entryId: string;
  generation: number;
  isPacked: boolean | null;
  kind: PackingListEntryOperation['kind'];
  packingListId: string;
}

function createEntryOperationKey(packingListId: string, entryId: string) {
  return `${packingListId}:${entryId}`
}

export const usePackingListsStore = defineStore('packing-lists', () => {
  const requestFetch = useRequestFetch()
  const serverRows = ref<PackingListSummary[]>([])
  const summaryStates = reactive(new Map<string, PackingListSummaryState>())
  const entryOperations = reactive(new Map<string, PackingListEntryOperation>())
  const hasLoaded = ref(false)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  let activeFetchController: AbortController | null = null
  let generation = 0
  let nextEntryOperationId = 0
  const rows = computed(() => serverRows.value.map((row) => summaryStates.get(row.id)?.summary ?? row))
  const hasUnavailableError = computed(() => errorMessage.value !== null && hasLoaded.value === false)
  const isEmpty = computed(() => rows.value.length === 0)
  const isInitialLoading = computed(() => loading.value && hasLoaded.value === false)

  function abortActiveFetch() {
    activeFetchController?.abort()
  }

  function getEntryOperation(packingListId: string, entryId: string) {
    const operationKey = createEntryOperationKey(packingListId, entryId)

    return entryOperations.get(operationKey)
  }

  function beginEntryOperation(options: PackingListEntryOperationOptions) {
    const {
      entryId,
      generation: operationGeneration,
      isPacked,
      kind,
      packingListId
    } = options

    const operationKey = createEntryOperationKey(packingListId, entryId)
    const currentOperation = entryOperations.get(operationKey)

    if (currentOperation?.isPending === true) {
      throw new Error('Packing list entry operation already pending')
    }

    const rollbackState = currentOperation?.kind === 'update'
      && currentOperation.isPacked !== null
      && currentOperation.updatedAt !== null
      ? {
          isPacked: currentOperation.isPacked,
          updatedAt: currentOperation.updatedAt
        }
      : null

    nextEntryOperationId += 1

    const operation: PackingListEntryOperation = {
      entryId,
      generation: operationGeneration,
      isPacked,
      isPending: true,
      kind,
      operationId: nextEntryOperationId,
      packingListId,
      rollbackState,
      updatedAt: null
    }

    entryOperations.set(operationKey, operation)

    return operation
  }

  function completeEntryOperation(operation: PackingListEntryOperation, updatedAt: Date | string) {
    const operationKey = createEntryOperationKey(operation.packingListId, operation.entryId)
    const currentOperation = entryOperations.get(operationKey)

    if (operation.generation !== generation || currentOperation?.operationId !== operation.operationId) {
      return
    }

    entryOperations.set(operationKey, {
      ...operation,
      isPending: false,
      rollbackState: null,
      updatedAt: String(updatedAt)
    })
  }

  function discardEntryOperation(operation: PackingListEntryOperation) {
    const operationKey = createEntryOperationKey(operation.packingListId, operation.entryId)
    const currentOperation = entryOperations.get(operationKey)

    if (currentOperation?.operationId !== operation.operationId) {
      return
    }

    if (operation.rollbackState === null) {
      entryOperations.delete(operationKey)

      return
    }

    entryOperations.set(operationKey, {
      ...operation,
      isPacked: operation.rollbackState.isPacked,
      isPending: false,
      kind: 'update',
      rollbackState: null,
      updatedAt: operation.rollbackState.updatedAt
    })
  }

  function reconcileEntryOperations(packingList: PackingListDetail) {
    for (const operation of entryOperations.values()) {
      if (operation.packingListId === packingList.id
        && operation.isPending === false
        && operation.updatedAt !== null) {
        const operationKey = createEntryOperationKey(operation.packingListId, operation.entryId)
        const entry = packingList.entries.find((currentEntry) => currentEntry.id === operation.entryId)
        const operationUpdatedAt = operation.updatedAt

        if (operation.kind === 'update'
          && entry !== undefined
          && Date.parse(entry.updatedAt) >= Date.parse(operationUpdatedAt)) {
          entryOperations.delete(operationKey)
        }

        if (operation.kind === 'delete'
          && entry === undefined
          && Date.parse(packingList.updatedAt) >= Date.parse(operationUpdatedAt)) {
          entryOperations.delete(operationKey)
        }
      }
    }
  }

  function applyEntryOperation(packingListId: string, entry: PackingListEntry): PackingListEntry | null {
    const operation = getEntryOperation(packingListId, entry.id)

    if (operation?.kind === 'delete' && operation.isPending === false) {
      return null
    }

    if (operation?.kind !== 'update' || operation.isPacked === null) {
      return entry
    }

    return {
      ...entry,
      isPacked: operation.isPacked,
      updatedAt: operation.updatedAt ?? entry.updatedAt
    }
  }

  function getPackingListDetailView(packingList: PackingListDetail): PackingListDetail {
    const entries: PackingListEntry[] = []

    for (const entry of packingList.entries) {
      const currentEntry = applyEntryOperation(packingList.id, entry)

      if (currentEntry !== null) {
        entries.push(currentEntry)
      }
    }

    return {
      ...packingList,
      entries
    }
  }

  function isPackingListEntryOperationPending(packingListId: string, entryId: string) {
    return getEntryOperation(packingListId, entryId)?.isPending === true
  }

  function isPackingListEntryUpdating(packingListId: string, entryId: string) {
    const operation = getEntryOperation(packingListId, entryId)

    return operation?.kind === 'update' && operation.isPending
  }

  function isPackingListEntryRemoving(packingListId: string, entryId: string) {
    const operation = getEntryOperation(packingListId, entryId)

    return operation?.kind === 'delete' && operation.isPending
  }

  function getRemovingPackingListEntryId(packingListId: string) {
    for (const operation of entryOperations.values()) {
      if (operation.packingListId === packingListId && operation.kind === 'delete' && operation.isPending) {
        return operation.entryId
      }
    }

    return null
  }

  function createSummarySnapshots() {
    return new Map<string, PackingListSummarySnapshot>([...summaryStates].map(([id, state]) => [id, {
      pendingOperations: state.pendingOperations,
      version: state.version
    }]))
  }

  function canApplyFetchedSummary(packingListId: string, snapshots: Map<string, PackingListSummarySnapshot>) {
    const currentState = summaryStates.get(packingListId)

    if (currentState === undefined) {
      return true
    }

    const snapshot = snapshots.get(packingListId)

    return snapshot?.pendingOperations === 0
      && currentState.version === snapshot.version
  }

  function reconcileFetchedSummaries(
    nextRows: PackingListSummary[],
    snapshots: Map<string, PackingListSummarySnapshot>
  ) {
    const nextIds = new Set(nextRows.map((row) => row.id))

    for (const row of nextRows) {
      if (canApplyFetchedSummary(row.id, snapshots)) {
        const currentState = summaryStates.get(row.id)

        summaryStates.set(row.id, {
          pendingOperations: currentState?.pendingOperations ?? 0,
          summary: row,
          version: currentState?.version ?? 0
        })
      }
    }

    for (const [packingListId, state] of summaryStates) {
      if (nextIds.has(packingListId) === false) {
        const snapshot = snapshots.get(packingListId)

        const canRemoveSummary = snapshot?.pendingOperations === 0
          && state.version === snapshot.version

        if (canRemoveSummary) {
          summaryStates.delete(packingListId)
        }
      }
    }
  }

  function replaceSummary(
    packingListId: string,
    pendingOperationsChange: number,
    updateSummary?: (summary: PackingListSummary) => PackingListSummary
  ) {
    const state = summaryStates.get(packingListId)

    if (state === undefined) {
      return false
    }

    const nextSummary = updateSummary?.(state.summary) ?? state.summary

    summaryStates.set(packingListId, {
      pendingOperations: Math.max(0, state.pendingOperations + pendingOperationsChange),
      summary: nextSummary,
      version: state.version + 1
    })

    return true
  }

  function beginSummaryOperation(
    packingListId: string,
    updateSummary?: (summary: PackingListSummary) => PackingListSummary
  ): PackingListSummaryOperation {
    const isTracked = replaceSummary(packingListId, 1, updateSummary)

    return {
      generation,
      isTracked,
      packingListId
    }
  }

  function finishSummaryOperation(
    operation: PackingListSummaryOperation,
    updateSummary?: (summary: PackingListSummary) => PackingListSummary
  ) {
    if (operation.generation !== generation || operation.isTracked === false) {
      return
    }

    replaceSummary(operation.packingListId, -1, updateSummary)
  }

  async function fetchPackingLists() {
    abortActiveFetch()

    const fetchController = new globalThis.AbortController()
    const fetchGeneration = generation
    const summarySnapshots = createSummarySnapshots()

    activeFetchController = fetchController
    loading.value = true

    try {
      const fetchedRows = await requestFetch('/api/user/packing-lists', {
        signal: fetchController.signal
      })

      if (fetchController.signal.aborted || fetchGeneration !== generation) {
        return
      }

      const normalizedRows = fetchedRows.map((row) => normalizePackingListSummary(row))

      reconcileFetchedSummaries(normalizedRows, summarySnapshots)

      serverRows.value = normalizedRows
      hasLoaded.value = true
      errorMessage.value = null
    } catch {
      const isFetchAborted = fetchController.signal.aborted

      if (isFetchAborted || fetchGeneration !== generation) {
        return
      }

      if (hasLoaded.value === false) {
        errorMessage.value = 'Could not load packing lists.'
      }
    } finally {
      const isCurrentFetch = activeFetchController === fetchController

      if (isCurrentFetch) {
        activeFetchController = null
        loading.value = false
      }
    }
  }

  async function createPackingList(name: string) {
    abortActiveFetch()

    const createdList = await requestFetch('/api/user/packing-lists', {
      method: 'POST',

      body: {
        name
      }
    })

    await fetchPackingLists()

    return createdList
  }

  function initializePackingListSummary(packingList: PackingListDetail) {
    if (packingList.id === '') {
      return
    }

    reconcileEntryOperations(packingList)

    const currentState = summaryStates.get(packingList.id)

    if (currentState !== undefined && currentState.pendingOperations > 0) {
      return
    }

    const nextSummary = normalizePackingListSummary({
      createdAt: packingList.createdAt,
      entryCount: packingList.entries.length,
      id: packingList.id,
      name: packingList.name,
      packedCount: countPackedEntries(packingList.entries),
      updatedAt: packingList.updatedAt
    })

    if (currentState !== undefined
      && Date.parse(nextSummary.updatedAt) < Date.parse(currentState.summary.updatedAt)) {
      return
    }

    summaryStates.set(packingList.id, {
      pendingOperations: 0,
      summary: nextSummary,
      version: (currentState?.version ?? 0) + 1
    })
  }

  async function createPackingListEntry(packingListId: string, body: PackingListEntryCreateBody) {
    const operation = beginSummaryOperation(packingListId)

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries`, {
        method: 'POST',
        body
      })

      finishSummaryOperation(operation, (summary) => {
        const packedCountChange = response.entry.isPacked ? 1 : 0

        return {
          ...summary,
          entryCount: summary.entryCount + 1,
          packedCount: summary.packedCount + packedCountChange,
          updatedAt: latestPackingListUpdatedAt(summary.updatedAt, response.packingListUpdatedAt)
        }
      })

      return response
    } catch (error) {
      finishSummaryOperation(operation)

      throw error
    }
  }

  async function updatePackingListEntry(options: PackingListEntryUpdateOptions) {
    const {
      entryId,
      isPacked,
      packingListId,
      previousIsPacked
    } = options

    const packedCountChange = Number(isPacked) - Number(previousIsPacked)

    const entryOperation = beginEntryOperation({
      entryId,
      generation,
      isPacked,
      kind: 'update',
      packingListId
    })

    const operation = beginSummaryOperation(packingListId, (summary) => {
      return {
        ...summary,
        packedCount: summary.packedCount + packedCountChange
      }
    })

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entryId}`, {
        method: 'PATCH',
        body: { isPacked }
      })

      finishSummaryOperation(operation, (summary) => {
        const confirmedPackedCountChange = Number(response.entry.isPacked) - Number(isPacked)

        return {
          ...summary,
          packedCount: summary.packedCount + confirmedPackedCountChange,
          updatedAt: latestPackingListUpdatedAt(summary.updatedAt, response.packingListUpdatedAt)
        }
      })

      completeEntryOperation(entryOperation, response.entry.updatedAt)

      return response
    } catch (error) {
      finishSummaryOperation(operation, (summary) => {
        return {
          ...summary,
          packedCount: summary.packedCount - packedCountChange
        }
      })

      discardEntryOperation(entryOperation)

      throw error
    }
  }

  async function deletePackingListEntry(packingListId: string, entryId: string, isPacked: boolean) {
    const entryOperation = beginEntryOperation({
      entryId,
      generation,
      isPacked: null,
      kind: 'delete',
      packingListId
    })

    const operation = beginSummaryOperation(packingListId)

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entryId}`, {
        method: 'DELETE'
      })

      finishSummaryOperation(operation, (summary) => {
        const packedCountChange = isPacked ? 1 : 0

        return {
          ...summary,
          entryCount: Math.max(0, summary.entryCount - 1),
          packedCount: Math.max(0, summary.packedCount - packedCountChange),
          updatedAt: latestPackingListUpdatedAt(summary.updatedAt, response.packingListUpdatedAt)
        }
      })

      completeEntryOperation(entryOperation, response.packingListUpdatedAt)

      return response
    } catch (error) {
      finishSummaryOperation(operation)
      discardEntryOperation(entryOperation)

      throw error
    }
  }

  function clearPackingLists() {
    abortActiveFetch()

    generation += 1
    activeFetchController = null
    serverRows.value = []

    summaryStates.clear()
    entryOperations.clear()

    hasLoaded.value = false
    loading.value = false
    errorMessage.value = null
  }

  return {
    clearPackingLists,
    createPackingList,
    createPackingListEntry,
    deletePackingListEntry,
    errorMessage,
    fetchPackingLists,
    getPackingListDetailView,
    getRemovingPackingListEntryId,
    hasLoaded,
    hasUnavailableError,
    initializePackingListSummary,
    isEmpty,
    isInitialLoading,
    isPackingListEntryOperationPending,
    isPackingListEntryRemoving,
    isPackingListEntryUpdating,
    loading,
    rows,
    updatePackingListEntry
  }
})
