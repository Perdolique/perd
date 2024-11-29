import { count, eq } from 'drizzle-orm'
import * as v from 'valibot'

const paramsSchema = v.object({
  brandId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  const { brandId } = await getValidatedRouterParams(event, validateParams)

  const brand = await event.context.db
    .select({
      id: tables.brands.id,
      name: tables.brands.name,
      websiteUrl: tables.brands.websiteUrl,
      equipmentCount: count(tables.equipment.id)
    })
    .from(tables.brands)
    .where(
      eq(tables.brands.id, brandId)
    )
    .leftJoin(
      tables.equipment,
      eq(tables.equipment.brandId, tables.brands.id)
    )
    .groupBy(tables.brands.id)

  const foundBrand = brand[0]

  if (foundBrand === undefined) {
    throw createError({
      statusCode: 404,
      message: `Item with ID ${brandId} not found`
    })
  }

  return foundBrand
})
