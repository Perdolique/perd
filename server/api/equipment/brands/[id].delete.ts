import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'
import { validateBrandIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)

  let deletedBrandRows: BrandBaseRecord[] = []

  try {
    deletedBrandRows = await dbHttp
      .delete(brands)
      .where(
        eq(brandBaseSelection.id, brandId)
      )
      .returning(brandBaseSelection)
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to delete brand'
    })
  }

  const [currentBrand] = deletedBrandRows

  if (currentBrand === undefined) {
    throw createError({ status: 404 })
  }

  await dbHttp
    .insert(contributions)
    .values({
      userId,
      action: 'delete_brand',
      targetId: `${currentBrand.id}`,

      metadata: {
        name: currentBrand.name,
        slug: currentBrand.slug
      }
    })

  setResponseStatus(event, 204)
})
