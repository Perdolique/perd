import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'
import { categoryProperties, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { categoryPropertyBaseSelection } from '#server/utils/equipment/base-records'
import { validateCategoryPropertyParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { categoryId, propertyId } = await getValidatedRouterParams(event, validateCategoryPropertyParams)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    await dbWebsocket.transaction(async (transaction) => {
      const [currentProperty] = await transaction
        .delete(categoryProperties)
        .where(
          and(
            eq(categoryProperties.categoryId, categoryId),
            eq(categoryProperties.id, propertyId)
          )
        )
        .returning(categoryPropertyBaseSelection)

      if (currentProperty === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'delete_category_property',
          targetId: `${currentProperty.id}`,

          metadata: {
            categoryId,
            dataType: currentProperty.dataType,
            name: currentProperty.name,
            slug: currentProperty.slug,
            unit: currentProperty.unit
          }
        })
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete category property'
    })
  } finally {
    await dbWebsocket.$client.end()
  }

  setResponseStatus(event, 204)
})
