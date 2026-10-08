import type { InferInput } from 'valibot'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { packingLists } from '#server/database/schema'
import { createRuntimeWebSocketClient } from '#server/utils/config'

import {
  closePackingListWriteClient,
  lockPackingList,
  nextPackingListUpdatedAt
} from '#server/utils/packing-list-write'

import { validateSessionUser } from '#server/utils/session'

import {
  validatePackingListIdParams,
  validatePackingListMutationBody,
  type packingListMutationBodySchema
} from '#server/utils/validation/schemas'

interface PackingListSummary {
  createdAt: Date | string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof packingListMutationBodySchema>; }>) : Promise<PackingListSummary> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validatePackingListIdParams)
  const { name } = await readValidatedBody(event, validatePackingListMutationBody)
  const database = createRuntimeWebSocketClient()

  try {
    return await database.transaction(async (transaction) => {
      const list = await lockPackingList(transaction, id, userId)
      const updatedAt = nextPackingListUpdatedAt(list.updatedAt)

      const [updatedList] = await transaction
        .update(packingLists)
        .set({
          name,
          updatedAt
        })
        .where(
          and(
            eq(packingLists.id, id),
            eq(packingLists.userId, userId)
          )
        )
        .returning({
          createdAt: packingLists.createdAt,
          id: packingLists.id,
          name: packingLists.name,
          updatedAt: packingLists.updatedAt
        })

      if (updatedList === undefined) {
        throw new Error('Packing list rename returned no row')
      }

      return updatedList
    }, { isolationLevel: 'read committed' })
  } catch (error) {
    if (isNuxtError(error) && error.status < 500) {
      throw error
    }

    console.error('Failed to rename packing list', error)

    throw createError({
      status: 500,
      message: 'Could not rename packing list'
    })
  } finally {
    await closePackingListWriteClient(database)
  }
})
