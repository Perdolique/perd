import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { packingLists } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'

import {
  validatePackingListIdParams,
  validatePackingListMutationBody
} from '#server/utils/validation/schemas'

interface PackingListSummary {
  createdAt: Date | string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export default defineEventHandler(async (event) : Promise<PackingListSummary> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)
  const { name } = await readValidatedBody(event, validatePackingListMutationBody)

  const [updatedList] = await event.context.dbHttp
    .update(packingLists)
    .set({
      name
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
    throw createError({ status: 404 })
  }

  return updatedList
})
