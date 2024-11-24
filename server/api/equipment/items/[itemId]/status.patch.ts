
import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { equipmentStatuses } from '~~/shared/models/equipment'

const paramsSchema = v.object({
  itemId: stringToIntegerValidator
})

const bodySchema = v.object({
  status: v.union([
    v.literal(equipmentStatuses.draft),
    v.literal(equipmentStatuses.active)
  ])
})

function paramsValidator(params: unknown) {
  return v.parse(paramsSchema, params)
}

function bodyValidator(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  await validateAdmin(event)

  const { itemId } = await getValidatedRouterParams(event, paramsValidator)
  const { status } = await readValidatedBody(event, bodyValidator)

  const [item] = await event.context.db
    .update(tables.equipment)
    .set({ status })
    .where(
      eq(tables.equipment.id, itemId)
    )
    .returning({
      id: tables.equipment.id,
      status: tables.equipment.status
    })

  if (item === undefined) {
    throw createError({
      statusCode: 404,
      message: `Item with ID ${itemId} not found`
    })
  }

  return item
})
