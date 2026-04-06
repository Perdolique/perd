import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { createWebSocketClient } from '#server/utils/database'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { validateCategoryIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: categoryId } = await getValidatedRouterParams(event, validateCategoryIdParams)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const dbWrite = createWebSocketClient(databaseConfig)

  try {
    await dbWrite.transaction(async (transaction) => {
      const deletedCategoryRows: CategoryBaseRecord[] = await transaction
        .delete(equipmentCategories)
        .where(
          eq(categoryBaseSelection.id, categoryId)
        )
        .returning(categoryBaseSelection)

      const [currentCategory] = deletedCategoryRows

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
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete category'
    })
  } finally {
    await dbWrite.$client.end()
  }

  setResponseStatus(event, 204)
})
