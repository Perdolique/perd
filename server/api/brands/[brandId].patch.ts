import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { limits } from '~~/constants'

const paramsSchema = v.object({
  brandId: stringToIntegerValidator
})

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxBrandNameLength)
  ),

  websiteUrl: v.optional(
    v.pipe(
      v.string(),
      v.url(),
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
  const { db } = event.context
  const { brandId } = await getValidatedRouterParams(event, validateParams)
  const { name, websiteUrl } = await readValidatedBody(event, validateBody)

  await validateAdmin(event)

  const [updated] = await db
    .update(tables.brands)
    .set({
      name,
      websiteUrl
    })
    .where(
      eq(tables.brands.id, brandId)
    )
    .returning({
      id: tables.brands.id,
      name: tables.brands.name,
      websiteUrl: tables.brands.websiteUrl
    })

  if (updated === undefined) {
    throw createError({
      statusCode: 404,
      message: `Brand with ID ${brandId} not found`
    })
  }

  return updated
})
