import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { limits } from '~~/constants'

const paramsSchema = v.object({
  itemId: stringToIntegerValidator
})

const bodySchema = v.object({
  name: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.maxLength(limits.maxEquipmentItemNameLength)
    )
  ),

  description: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(limits.maxEquipmentDescriptionLength)
    )
  ),

  weight: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0)
    )
  ),

  typeId: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    )
  ),

  groupId: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    )
  )
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  await validateAdmin(event)


  const { itemId } = await getValidatedRouterParams(event, validateParams)
  const { name, description, weight, typeId, groupId } = await readValidatedBody(event, validateBody)

  const setParams = {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description: description === '' ? null : description }),
    ...(weight !== undefined && { weight }),
    ...(typeId !== undefined && { equipmentTypeId: typeId }),
    ...(groupId !== undefined && { equipmentGroupId: groupId })
  }

  const [item] = await event.context.db
    .update(tables.equipment)
    .set(setParams)
    .where(
      eq(tables.equipment.id, itemId)
    )
    .returning({
      id: tables.equipment.id,
      name: tables.equipment.name,
      description: tables.equipment.description,
      weight: tables.equipment.weight,
      equipmentTypeId: tables.equipment.equipmentTypeId,
      equipmentGroupId: tables.equipment.equipmentGroupId
    })

  if (item === undefined) {
    throw createError({
      statusCode: 404,
      message: `Item with ID ${itemId} not found`
    })
  }

  return item
})
