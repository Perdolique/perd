import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { createWebSocketClient } from '#server/utils/database'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'
import { validateBrandIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const dbWrite = createWebSocketClient(databaseConfig)

  try {
    await dbWrite.transaction(async (transaction) => {
      const deletedBrandRows: BrandBaseRecord[] = await transaction
        .delete(brands)
        .where(
          eq(brandBaseSelection.id, brandId)
        )
        .returning(brandBaseSelection)

      const [currentBrand] = deletedBrandRows

      if (currentBrand === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
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
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete brand'
    })
  } finally {
    await dbWrite.$client.end()
  }

  setResponseStatus(event, 204)
})
