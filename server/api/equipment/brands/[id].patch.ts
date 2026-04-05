import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'

import {
  validateBrandIdParams,
  validateBrandMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)

  let updatedBrandRows: BrandBaseRecord[] = []

  try {
    updatedBrandRows = await dbHttp
      .update(brands)
      .set({
        name,
        slug
      })
      .where(
        eq(brandBaseSelection.id, brandId)
      )
      .returning(brandBaseSelection)
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to update brand'
    })
  }

  const [updatedBrand] = updatedBrandRows

  if (updatedBrand === undefined) {
    throw createError({ status: 404 })
  }

  await dbHttp
    .insert(contributions)
    .values({
      userId,
      action: 'update_brand',
      targetId: `${updatedBrand.id}`,
      metadata: {
        name: updatedBrand.name,
        slug: updatedBrand.slug
      }
    })

  return updatedBrand
})
