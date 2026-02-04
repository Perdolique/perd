import { defineEventHandler, createError, getValidatedRouterParams } from 'h3'
import { and, asc, eq } from 'drizzle-orm'
import * as v from 'valibot'
import { stringToIntegerValidator } from '#server/utils/validate'
import { tables } from '#server/utils/database'

const paramsSchema = v.object({
  brandId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  const { brandId } = await getValidatedRouterParams(event, validateParams)

  // First verify the brand exists
  const brand = await event.context.db
    .select({
      id: tables.brands.id
    })
    .from(tables.brands)
    .where(
      eq(tables.brands.id, brandId)
    )

  if (brand[0] === undefined) {
    throw createError({
      status: 404,
      message: `Brand with ID ${brandId} not found`
    })
  }

  // Get all active equipment items for this brand
  const equipment = await event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name,
      weight: tables.equipment.weight
    })
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.brandId, brandId),
        eq(tables.equipment.status, 'active')
      )
    )
    .orderBy(asc(tables.equipment.name))

  return equipment
})
