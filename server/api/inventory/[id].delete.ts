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
