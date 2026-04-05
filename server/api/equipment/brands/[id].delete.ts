import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { validateBrandIdParams } from '#server/utils/validation/schemas'

interface BrandRecord {
  id: number;
  name: string;
  slug: string;
}

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)

  let deletedBrandRows: BrandRecord[] = []

  try {
    deletedBrandRows = await dbHttp
      .delete(brands)
      .where(
        eq(brands.id, brandId)
      )
      .returning({
        id: brands.id,
        name: brands.name,
        slug: brands.slug
      })
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

  const targetId = String(currentBrand.id)

  await dbHttp
    .insert(contributions)
    .values({
      userId,
      action: 'delete_brand',
      targetId,

      metadata: {
        name: currentBrand.name,
        slug: currentBrand.slug
      }
    })

  setResponseStatus(event, 204)
})
