import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, readValidatedBody } from 'nuxt/server'
import { packingListEntries, packingLists } from '#server/database/schema'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { readPackingListDetail, type PackingListDetail } from '#server/utils/packing-list-detail'

import {
  closePackingListWriteClient,
  lockPackingList,
  nextPackingListUpdatedAt
} from '#server/utils/packing-list-write'

import { getValidatedRouteParams } from '#server/utils/request'
import { validateSessionUser } from '#server/utils/session'
import { validatePackingListClearPackedBody, validatePackingListIdParams } from '#server/utils/validation/schemas'

interface ClearPackedResponse {
  packingList: PackingListDetail;
  outcome: 'cleared' | 'conflict';
}

export default defineEventHandler(async (event): Promise<ClearPackedResponse> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validatePackingListIdParams)
  const { expectedUpdatedAt } = await readValidatedBody(event, validatePackingListClearPackedBody)
  const expectedVersion = Date.parse(expectedUpdatedAt)
  const database = createRuntimeWebSocketClient()

  try {
    return await database.transaction(async (transaction): Promise<ClearPackedResponse> => {
      const list = await lockPackingList(transaction, id, userId)
      const currentVersion = list.updatedAt.getTime()

      // Replays must not clear marks saved after the originally confirmed version.
      if (currentVersion !== expectedVersion) {
        const packingList = await readPackingListDetail(transaction, id, userId)

        return {
          packingList,
          outcome: 'conflict'
        }
      }

      const updatedAt = nextPackingListUpdatedAt(list.updatedAt)

      const changed = await transaction
        .update(packingListEntries)
        .set({
          isPacked: false,
          updatedAt
        })
        .where(
          and(
            eq(packingListEntries.packingListId, id),
            eq(packingListEntries.isPacked, true)
          )
        )
        .returning({ id: packingListEntries.id })

      if (changed.length > 0) {
        await transaction
          .update(packingLists)
          .set({ updatedAt })
          .where(
            eq(packingLists.id, id)
          )
      }

      const packingList = await readPackingListDetail(transaction, id, userId)

      return {
        packingList,
        outcome: 'cleared'
      }
    }, { isolationLevel: 'read committed' })
  } catch (error) {
    if (isNuxtError(error) && error.status < 500) {
      throw error
    }

    console.error('Failed to clear packed marks', error)

    throw createError({
      status: 500,
      message: 'Could not clear packed marks'
    })
  } finally {
    await closePackingListWriteClient(database)
  }
})
