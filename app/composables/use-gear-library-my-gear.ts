import { computed, shallowRef } from 'vue'
import { useRequestFetch } from '#imports'
import { useGearLibraryStore } from '~/stores/gear-library'

interface ErrorWithStatus {
  status?: number;
  statusCode?: number;
}

function getErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return
  }

  const errorWithStatus = error as ErrorWithStatus

  return errorWithStatus.statusCode ?? errorWithStatus.status
}

/** Owns independent per-item My Gear additions from the catalog. */
function useGearLibraryMyGear() {
  const requestFetch = useRequestFetch()
  const gearLibraryStore = useGearLibraryStore()
  const savingItemIds = shallowRef(new Set<string>())
  const failedItemIds = shallowRef(new Set<string>())
  const announcement = shallowRef('')
  const failedItemIdList = computed(() => [...failedItemIds.value])
  const savingItemIdList = computed(() => [...savingItemIds.value])

  async function addItem(itemId: string, itemName: string) {
    const isSaving = savingItemIds.value.has(itemId)

    if (isSaving) {
      return
    }

    announcement.value = ''

    const nextFailedItemIds = new Set(failedItemIds.value)

    nextFailedItemIds.delete(itemId)
    failedItemIds.value = nextFailedItemIds

    savingItemIds.value = new Set([...savingItemIds.value, itemId])

    try {
      await requestFetch('/api/user/gear', {
        body: { itemId },
        method: 'post'
      })

      gearLibraryStore.markItemSaved(itemId)
      announcement.value = `${itemName} added to My gear.`
    } catch (requestError) {
      const statusCode = getErrorStatus(requestError)

      if (statusCode === 409) {
        gearLibraryStore.markItemSaved(itemId)
        announcement.value = `${itemName} is already in My gear.`
      } else {
        failedItemIds.value = new Set([...failedItemIds.value, itemId])
        announcement.value = `Could not add ${itemName} to My gear.`
      }
    } finally {
      const remainingSavingItemIds = new Set(savingItemIds.value)

      remainingSavingItemIds.delete(itemId)
      savingItemIds.value = remainingSavingItemIds
    }
  }

  return {
    addItem,
    announcement,
    failedItemIds: failedItemIdList,
    savingItemIds: savingItemIdList
  }
}

export { useGearLibraryMyGear }
