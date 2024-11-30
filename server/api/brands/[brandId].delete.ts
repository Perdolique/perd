import { eq } from 'drizzle-orm'
import * as v from 'valibot'

const paramsSchema = v.object({
  brandId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  await validateAdmin(event)

  const { brandId } = await getValidatedRouterParams(event, validateParams)

  const deleted = await event.context.db
    .delete(tables.brands)
    .where(
      eq(tables.brands.id, brandId)
    )
    .returning({
      id: tables.brands.id
    })

  if (deleted.length === 0) {
    throw createError({
      statusCode: 404,
      message: `Brand with ID ${brandId} not found`
    })
  }

  setResponseStatus(event, 204)
})
