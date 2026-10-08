import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { brandBaseSelection } from '#server/utils/equipment/base-records'
import { throwBrandWriteError } from '#server/utils/equipment/brand-write-errors'
import { validateBrandIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<void> => {
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouteParams(event, validateBrandIdParams)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    await dbWebsocket.transaction(async (transaction) => {
      const [currentBrand] = await transaction
        .delete(brands)
        .where(
          eq(brandBaseSelection.id, brandId)
        )
        .returning(brandBaseSelection)

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
    throwBrandWriteError(error, 'delete')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close brand write database client', { error })
    }
  }

  setResponseStatus(event, 204)
})
