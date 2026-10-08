import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { packingListEntries, packingLists } from '#server/database/schema'
import { createRuntimeWebSocketClient } from '#server/utils/config'

import {
  closePackingListWriteClient,
  lockPackingList,
  nextPackingListUpdatedAt
} from '#server/utils/packing-list-write'

import { validateSessionUser } from '#server/utils/session'
import { validatePackingListEntryParams } from '#server/utils/validation/schemas'

interface DeletePackingListEntryResponse {
  deletedEntryId: string;
  packingListUpdatedAt: Date | string;
}

export default defineEventHandler(async (event) : Promise<DeletePackingListEntryResponse> => {
  const userId = await validateSessionUser(event)
  const { entryId, id } = await getValidatedRouteParams(event, validatePackingListEntryParams)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const ownedList = await lockPackingList(transaction, id, userId)
      const updatedAt = nextPackingListUpdatedAt(ownedList.updatedAt)

      const [deletedEntry] = await transaction
        .delete(packingListEntries)
        .where(
          and(
            eq(packingListEntries.id, entryId),
            eq(packingListEntries.packingListId, id)
          )
        )
        .returning({
          id: packingListEntries.id
        })

      if (deletedEntry === undefined) {
        throw createError({ status: 404 })
      }

      const [updatedList] = await transaction
        .update(packingLists)
        .set({
          updatedAt
        })
        .where(
          and(
            eq(packingLists.id, id),
            eq(packingLists.userId, userId)
          )
        )
        .returning({
          updatedAt: packingLists.updatedAt
        })

      if (updatedList === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to touch packing list'
        })
      }

      return {
        deletedEntryId: deletedEntry.id,
        packingListUpdatedAt: updatedList.updatedAt
      }
    }, { isolationLevel: 'read committed' })
  } catch (error) {
    if (isNuxtError(error) && error.status < 500) {
      throw error
    }

    console.error('Failed to delete packing list entry', error)

    throw createError({
      status: 500,
      message: 'Failed to delete packing list entry'
    })
  } finally {
    await closePackingListWriteClient(dbWebsocket)
  }
})
