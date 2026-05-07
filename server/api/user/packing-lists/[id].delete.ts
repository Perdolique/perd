import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { packingLists } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validatePackingListIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) : Promise<void> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)

  const [deletedList] = await event.context.dbHttp
    .delete(packingLists)
    .where(
      and(
        eq(packingLists.id, id),
        eq(packingLists.userId, userId)
      )
    )
    .returning({
      id: packingLists.id
    })

  if (deletedList === undefined) {
    throw createError({ status: 404 })
  }

  setResponseStatus(event, 204)
})
