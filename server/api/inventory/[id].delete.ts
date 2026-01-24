import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { validateSessionUser, validateStringToInteger } from '#server/utils/validate'
import { tables } from '#server/utils/database'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const id = getRouterParam(event, 'id')
  const equipmentId = validateStringToInteger(id)

  await event.context.db
    .delete(tables.userEquipment)
    .where(
      and(
        eq(tables.userEquipment.userId, userId),
        eq(tables.userEquipment.equipmentId, equipmentId)
      )
    )

  setResponseStatus(event, 204)
})
