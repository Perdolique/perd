import { computed, shallowRef, watch } from 'vue'
import { useAsyncData, useRequestFetch } from '#imports'

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

/** Owns catalog My Gear status and independent per-item additions. */
async function useGearLibraryMyGear() {
  const requestFetch = useRequestFetch()
  const savedItemIds = shallowRef(new Set<string>())
  const savingItemIds = shallowRef(new Set<string>())
  const failedItemIds = shallowRef(new Set<string>())
  const announcement = shallowRef('')

  const {
    data: myGearRows,
    error,
    refresh,
    status
  } = await useAsyncData('gear-library-my-gear', async () => {
    const rows = await requestFetch('/api/user/gear', {
      method: 'get'
    })

    return rows
  }, {
    default: () => []
  })

  watch(myGearRows, (rows) => {
    savedItemIds.value = new Set(rows.map((row) => row.item.id))
  }, {
    immediate: true
  })

  const hasInitialError = computed(() => error.value !== undefined)
  const failedItemIdList = computed(() => [...failedItemIds.value])
  const savedItemIdList = computed(() => [...savedItemIds.value])
  const savingItemIdList = computed(() => [...savingItemIds.value])

  async function addItem(itemId: string, itemName: string) {
    const isSaved = savedItemIds.value.has(itemId)
    const isSaving = savingItemIds.value.has(itemId)

    if (isSaved || isSaving) {
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

      savedItemIds.value = new Set([...savedItemIds.value, itemId])
      announcement.value = `${itemName} added to My gear.`
    } catch (requestError) {
      const statusCode = getErrorStatus(requestError)

      if (statusCode === 409) {
        savedItemIds.value = new Set([...savedItemIds.value, itemId])
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
    hasInitialError,
    refresh,
    savedItemIds: savedItemIdList,
    savingItemIds: savingItemIdList,
    status
  }
}

export { useGearLibraryMyGear }
