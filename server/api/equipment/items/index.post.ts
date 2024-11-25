import * as v from 'valibot'
import { limits } from '~~/constants'
import type { EquipmentStatus } from '#shared/models/equipment';

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxEquipmentItemNameLength)
  ),

  description: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.maxLength(limits.maxEquipmentDescriptionLength)
    )
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
  ),

  brandId: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    )
  )
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const userId = await validateSessionUser(event)
  const body = await readValidatedBody(event, validateBody)
  const status: EquipmentStatus = 'draft'
  const description = body.description ?? null
  const brandId = body.brandId ?? null

  const [inserted] = await db
    .insert(tables.equipment)
    .values({
      description,
      status,
      creatorId: userId,
      brandId,
      name: body.name,
      weight: body.weight,
      equipmentTypeId: body.typeId,
      equipmentGroupId: body.groupId
    })
    .returning({
      id: tables.equipment.id
    })

  if (inserted?.id === undefined) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create equipment item'
    })
  }

  setResponseStatus(event, 201)
})
