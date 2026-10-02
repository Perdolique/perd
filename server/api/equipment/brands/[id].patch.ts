import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'
import { throwBrandWriteError } from '#server/utils/equipment/brand-write-errors'
import { validateBrandIdParams, validateBrandMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<BrandBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [updatedBrand] = await transaction
        .update(brands)
        .set({
          name,
          slug
        })
        .where(
          eq(brandBaseSelection.id, brandId)
        )
        .returning(brandBaseSelection)

      if (updatedBrand === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
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
  } catch (error) {
    throwBrandWriteError(error, 'update')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close brand write database client', { error })
    }
  }
})
