import { eq } from 'drizzle-orm'
import * as v from 'valibot'

const paramsSchema = v.object({
  itemId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  await validateAdmin(event)

  const { itemId } = await getValidatedRouterParams(event, validateParams)

  const deleted = await event.context.db
    .delete(tables.equipment)
    .where(
      eq(tables.equipment.id, itemId)
    )
    .returning({
      id: tables.equipment.id
    })

  if (deleted.length === 0) {
    throw createError({
      statusCode: 404,
      message: `Item with ID ${itemId} not found`
    })
  }

  setResponseStatus(event, 204)
})
