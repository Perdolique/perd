import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validateUserEquipmentIdParams)

  const [deletedInventoryRow] = await event.context.dbHttp
    .delete(userEquipment)
    .where(
      and(
        eq(userEquipment.id, id),
        eq(userEquipment.userId, userId)
      )
    )
    .returning({
      id: userEquipment.id
    })

  if (deletedInventoryRow === undefined) {
    throw createError({ status: 404 })
  }

  setResponseStatus(event, 204)
})
