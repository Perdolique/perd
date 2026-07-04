import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentIdParams } from '#server/utils/validation/schemas'

interface PostgresError {
  code?: string;
}

function isForeignKeyViolation(error: unknown): error is PostgresError {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const postgresError = error as PostgresError

  return postgresError.code === '23503'
}

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validateUserEquipmentIdParams)

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
    if (isForeignKeyViolation(error)) {
      throw createError({
        status: 409,
        message: 'My gear item is still used in a list'
      })
    }

    throw error
  }
})
