import { and, eq, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError } from 'h3'
import { packingListEntries, packingLists } from '#server/database/schema'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { validateSessionUser } from '#server/utils/session'
import { validatePackingListEntryParams } from '#server/utils/validation/schemas'

interface DeletePackingListEntryResponse {
  deletedEntryId: string;
  packingListUpdatedAt: Date | string;
}

export default defineEventHandler(async (event) : Promise<DeletePackingListEntryResponse> => {
  const userId = await validateSessionUser(event)
  const { entryId, id } = await getValidatedRouterParams(event, validatePackingListEntryParams)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [ownedList] = await transaction
        .select({
          id: packingLists.id
        })
        .from(packingLists)
        .where(
          and(
            eq(packingLists.id, id),
            eq(packingLists.userId, userId)
          )
        )
        .limit(1)

      if (ownedList === undefined) {
        throw createError({ status: 404 })
      }

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
          updatedAt: sql`now()`
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
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete packing list entry'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
