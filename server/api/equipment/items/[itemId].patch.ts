import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { limits } from '~~/constants'

const paramsSchema = v.object({
  itemId: stringToIntegerValidator
})

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxEquipmentItemNameLength)
  ),

  description: v.pipe(
    v.string(),
    v.maxLength(limits.maxEquipmentDescriptionLength),
    v.transform(value => value === '' ? null : value)
  ),

  weight: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0)
  ),

  typeId: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1)
  ),

  groupId: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1)
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

  const [item] = await event.context.db
    .update(tables.equipment)
    .set({
      name,
      description,
      weight,
      equipmentTypeId: typeId,
      equipmentGroupId: groupId
    })
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
