import { eq } from 'drizzle-orm'
import * as v from 'valibot'

const paramsSchema = v.object({
  itemId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  const { itemId } = await getValidatedRouterParams(event, validateParams)

  const item = await event.context.db
  .select({
    equipment: {
      id: tables.equipment.id,
      name: tables.equipment.name,
      description: tables.equipment.description,
      weight: tables.equipment.weight
    },

    group: {
      id: tables.equipmentTypes.id,
      name: tables.equipmentTypes.name
    },

    type: {
      id: tables.equipmentGroups.id,
      name: tables.equipmentGroups.name
    }
  })
  .from(tables.equipment)
  .where(
    eq(tables.equipment.id, itemId)
  )
  .leftJoin(
    tables.equipmentTypes,
    eq(tables.equipment.equipmentTypeId, tables.equipmentTypes.id)
  )
  .leftJoin(
    tables.equipmentGroups,
    eq(tables.equipment.equipmentGroupId, tables.equipmentGroups.id)
  )

  const foundItem = item[0]

  if (foundItem === undefined) {
    throw createError({
      statusCode: 404,
      message: `Item with ID ${itemId} not found`
    })
  }

  return foundItem
})
