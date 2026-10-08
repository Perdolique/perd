import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentIdParams } from '#server/utils/validation/schemas'
import { throwMyGearError } from '#server/utils/my-gear-errors'

export default defineEventHandler(async (event) : Promise<void> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validateUserEquipmentIdParams)

  try {
    const [deletedMyGearRow] = await event.context.dbHttp
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

    if (deletedMyGearRow === undefined) {
      throw createError({ status: 404 })
    }

    setResponseStatus(event, 204)
  } catch (error) {
    throwMyGearError(error, 'delete')
  }
})
