import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { categoryBaseSelection } from '#server/utils/equipment/base-records'
import { logCategoryWriteError, throwCategoryWriteError } from '#server/utils/equipment/category-write-errors'
import { validateCategoryScopedParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<void> => {
  const userId = await validateAdminUser(event)
  const { categoryId } = await getValidatedRouteParams(event, validateCategoryScopedParams)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    await dbWebsocket.transaction(async (transaction) => {
      const [currentCategory] = await transaction
        .delete(equipmentCategories)
        .where(
          eq(categoryBaseSelection.id, categoryId)
        )
        .returning(categoryBaseSelection)

      if (currentCategory === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'delete_category',
          targetId: `${currentCategory.id}`,

          metadata: {
            name: currentCategory.name,
            slug: currentCategory.slug
          }
        })
    })
  } catch (error) {
    throwCategoryWriteError(error, 'delete')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      logCategoryWriteError('Failed to close category write database client', error)
    }
  }

  setResponseStatus(event, 204)
})
