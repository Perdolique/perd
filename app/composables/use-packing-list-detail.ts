import { computed, ref } from 'vue'
import { navigateTo, useFetch, useRequestFetch, useRoute } from '#imports'
import type { MyGearRecord } from '~/types/equipment'
import type { PackingListDetailMode, PackingListDetail, PackingListEntry, PackingListEntryView } from '~/types/packing'
import { appRoutes } from '~/utils/navigation'
import { packingListDateFormatter } from '~/utils/packing'
import {
  getEntryDetailText,
  getEntryDisplayName,
  getErrorStatusCode,
  normalizeDateString,
  normalizePackingListEntry
} from '~/utils/packing-detail'

function getPackingListId() {
  const route = useRoute()

  if (Array.isArray(route.params.id)) {
    return route.params.id[0] ?? ''
  }

  return route.params.id
}

function createEmptyPackingList(): PackingListDetail {
  return { createdAt: '', entries: [], id: '', name: '', updatedAt: '' }
}

export async function usePackingListDetail() {
  const packingListId = getPackingListId()
  const requestFetch = useRequestFetch()
  const detailMode = ref<PackingListDetailMode>('planning')
  const isDeleteDialogVisible = ref(false)
  const isDeleting = ref(false)
  const deleteErrorMessage = ref<string | null>(null)
  const newEntryName = ref('')
  const createEntryErrorMessage = ref<string | null>(null)
  const entryMutationErrorMessage = ref<string | null>(null)
  const isCreatingCustomEntry = ref(false)
  const creatingMyGearId = ref<string | null>(null)
  const mutatingEntryId = ref<string | null>(null)

  const {
    data: packingList,
    error: packingListError,
    refresh: refreshPackingList,
    status: packingListStatus
  } = await useFetch(`/api/user/packing-lists/${packingListId}`, {
    default: createEmptyPackingList,
    lazy: true
  })

  const {
    data: myGearResponse,
    error: myGearError,
    status: myGearStatus
  } = await useFetch('/api/user/gear', {
    default: (): MyGearRecord[] => []
  })

  function updatePackingListState(update: Partial<PackingListDetail>) {
    packingList.value = {
      createdAt: update.createdAt ?? packingList.value.createdAt,
      entries: update.entries ?? packingList.value.entries,
      id: update.id ?? packingList.value.id,
      name: update.name ?? packingList.value.name,
      updatedAt: update.updatedAt ?? packingList.value.updatedAt
    }
  }

  function resetEntryMessages() {
    createEntryErrorMessage.value = null
    entryMutationErrorMessage.value = null
  }

  function applyCreatedEntry(entry: PackingListEntry, packingListUpdatedAt: Date | string) {
    const normalizedEntry = normalizePackingListEntry(entry)
    const normalizedUpdatedAt = normalizeDateString(packingListUpdatedAt)

    updatePackingListState({
      entries: [
        ...packingList.value.entries,
        normalizedEntry
      ],
      updatedAt: normalizedUpdatedAt
    })
  }

  const hasError = computed(() => packingListError.value !== undefined)
  const isInitialLoading = computed(() => packingListStatus.value === 'pending')
  const hasMyGearError = computed(() => myGearError.value !== undefined)
  const isMyGearLoading = computed(() => myGearStatus.value === 'pending')
  const isPlanningMode = computed(() => detailMode.value === 'planning')
  const pageTitle = computed(() => hasError.value ? 'Packing list' : packingList.value.name)
  const deleteDialogHeaderText = computed(() => `Delete "${packingList.value.name}"?`)
  const entryCount = computed(() => packingList.value.entries.length)
  const packedCount = computed(() => packingList.value.entries.filter((entry) => entry.isPacked).length)
  const isMyGearEmpty = computed(() => myGearResponse.value.length === 0)
  const isEntryMutationPending = computed(() => mutatingEntryId.value !== null)
  const isMyGearCreatePending = computed(() => creatingMyGearId.value !== null)
  const isEntryCreatePending = computed(() => isCreatingCustomEntry.value || isMyGearCreatePending.value)
  const isAnyEntryActionPending = computed(() => isEntryCreatePending.value || isEntryMutationPending.value)
  const isCreateEntryErrorVisible = computed(() => createEntryErrorMessage.value !== null)
  const inventoryEntryIds = computed(() => new Set(
    packingList.value.entries
      .map((entry) => entry.inventory?.inventoryId)
      .filter((inventoryId): inventoryId is string => inventoryId !== undefined)
  ))
  const availableMyGearRows = computed(() => myGearResponse.value.filter(
    (myGearRow) => inventoryEntryIds.value.has(myGearRow.id) === false
  ))
  const isAvailableMyGearEmpty = computed(() => availableMyGearRows.value.length === 0)
  const isCreateCustomEntryDisabled = computed(() => {
    const trimmedName = newEntryName.value.trim()

    return trimmedName === '' || isAnyEntryActionPending.value
  })
  const createEntryDescribedBy = computed(() => {
    if (isCreateEntryErrorVisible.value === false) {
      return
    }

    return 'packing-list-entry-create-error'
  })
  const entryCountText = computed(() => {
    if (entryCount.value === 1) {
      return '1 item'
    }

    return `${entryCount.value} items`
  })
  const packedCountText = computed(() => `${packedCount.value} of ${entryCount.value} packed`)
  const formattedUpdatedAt = computed(() => {
    if (packingList.value.updatedAt === '') {
      return ''
    }

    return packingListDateFormatter.format(new Date(packingList.value.updatedAt))
  })
  const detailModeTitle = computed(() => isPlanningMode.value ? 'Planning' : 'Checklist')
  const detailModeIcon = computed(() => isPlanningMode.value ? 'hugeicons:edit-02' : 'hugeicons:checkmark-square-01')
  const detailModeSummary = computed(() => isPlanningMode.value ? entryCountText.value : packedCountText.value)
  const emptyStateCopy = computed(() => {
    if (isPlanningMode.value) {
      return 'Add custom items or pull from my gear while you build this list.'
    }

    return 'Switch to planning mode to add items before packing.'
  })
  const entryViews = computed<PackingListEntryView[]>(() => packingList.value.entries.map((entry) => {
    const isLoading = mutatingEntryId.value === entry.id
    const isDisabled = isAnyEntryActionPending.value
    const displayName = getEntryDisplayName(entry)
    const detailText = getEntryDetailText(entry)
    const stateClass = entry.isPacked ? 'packed' : 'unpacked'
    const stateText = entry.isPacked ? 'Packed' : 'Not packed'
    const toggleAction = entry.isPacked ? 'Mark unpacked' : 'Mark packed'
    const toggleLabel = `${toggleAction}: ${displayName}`

    return {
      createdAt: entry.createdAt,
      customName: entry.customName,
      detailText,
      displayName,
      id: entry.id,
      inventory: entry.inventory,
      isDisabled,
      isLoading,
      isPacked: entry.isPacked,
      source: entry.source,
      stateClass,
      stateText,
      toggleLabel,
      updatedAt: entry.updatedAt
    }
  }))

  function isAddMyGearDisabled(myGearId: string) {
    const isAlreadyAdded = inventoryEntryIds.value.has(myGearId)
    const isLoading = creatingMyGearId.value === myGearId

    return isAlreadyAdded || isLoading || isAnyEntryActionPending.value
  }

  async function handleRetry() {
    await refreshPackingList()
  }

  async function handleCreateCustomEntry() {
    if (isCreateCustomEntryDisabled.value) {
      return
    }

    resetEntryMessages()
    isCreatingCustomEntry.value = true

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries`, {
        method: 'POST',

        body: {
          customName: newEntryName.value
        }
      })

      applyCreatedEntry(response.entry, response.packingListUpdatedAt)
      newEntryName.value = ''
    } catch {
      createEntryErrorMessage.value = 'Could not add item.'
    } finally {
      isCreatingCustomEntry.value = false
    }
  }

  async function handleCreateMyGearEntry(myGearId: string) {
    if (isAddMyGearDisabled(myGearId)) {
      return
    }

    resetEntryMessages()
    creatingMyGearId.value = myGearId

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries`, {
        method: 'POST',

        body: {
          inventoryId: myGearId
        }
      })

      applyCreatedEntry(response.entry, response.packingListUpdatedAt)
    } catch (error) {
      const statusCode = getErrorStatusCode(error)

      createEntryErrorMessage.value = statusCode === 409
        ? 'This saved item is already in the list.'
        : 'Could not add saved item.'
    } finally {
      creatingMyGearId.value = null
    }
  }

  async function handleToggleEntry(entry: PackingListEntryView) {
    if (entry.isDisabled) {
      return
    }

    resetEntryMessages()
    mutatingEntryId.value = entry.id

    try {
      const nextIsPacked = entry.isPacked === false
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entry.id}`, {
        method: 'PATCH',

        body: {
          isPacked: nextIsPacked
        }
      })

      const updatedEntry = normalizePackingListEntry(response.entry)
      const normalizedUpdatedAt = normalizeDateString(response.packingListUpdatedAt)

      updatePackingListState({
        entries: packingList.value.entries.map((currentEntry) => {
          if (currentEntry.id !== updatedEntry.id) {
            return currentEntry
          }

          return updatedEntry
        }),
        updatedAt: normalizedUpdatedAt
      })
    } catch {
      entryMutationErrorMessage.value = 'Could not update item.'
    } finally {
      mutatingEntryId.value = null
    }
  }

  async function handleDeleteEntry(entry: PackingListEntryView) {
    if (entry.isDisabled) {
      return
    }

    resetEntryMessages()
    mutatingEntryId.value = entry.id

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entry.id}`, {
        method: 'DELETE'
      })

      updatePackingListState({
        entries: packingList.value.entries.filter((currentEntry) => currentEntry.id !== response.deletedEntryId),
        updatedAt: normalizeDateString(response.packingListUpdatedAt)
      })
    } catch {
      entryMutationErrorMessage.value = 'Could not remove item.'
    } finally {
      mutatingEntryId.value = null
    }
  }

  function showDeleteDialog() {
    deleteErrorMessage.value = null
    isDeleteDialogVisible.value = true
  }

  async function handleDeletePackingList() {
    if (isDeleting.value) {
      return
    }

    deleteErrorMessage.value = null
    isDeleting.value = true

    try {
      await requestFetch(`/api/user/packing-lists/${packingListId}`, {
        method: 'DELETE'
      })

      await navigateTo(appRoutes.packingLists)
    } catch (error) {
      const statusCode = getErrorStatusCode(error)

      if (statusCode === 404) {
        await navigateTo(appRoutes.packingLists)

        return
      }

      deleteErrorMessage.value = 'Could not delete list.'
    } finally {
      isDeleting.value = false
    }
  }

  return {
    availableMyGearRows, createEntryDescribedBy, createEntryErrorMessage, creatingMyGearId,
    deleteDialogHeaderText, deleteErrorMessage, detailMode, detailModeIcon, detailModeSummary,
    detailModeTitle, emptyStateCopy, entryCount, entryMutationErrorMessage, entryViews,
    formattedUpdatedAt, handleCreateCustomEntry, handleCreateMyGearEntry, handleDeleteEntry,
    handleDeletePackingList, handleRetry, handleToggleEntry, hasError, hasMyGearError,
    isAnyEntryActionPending, isAvailableMyGearEmpty, isCreateCustomEntryDisabled,
    isCreatingCustomEntry, isDeleteDialogVisible, isDeleting, isInitialLoading, isMyGearEmpty,
    isMyGearLoading, isPlanningMode, newEntryName, packedCount, packingList, pageTitle,
    showDeleteDialog
  }
}
