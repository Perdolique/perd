import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { throwCategoryWriteError } from '#server/utils/equipment/category-write-errors'
import { validateCategoryIdParams, validateCategoryMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<CategoryBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { id: categoryId } = await getValidatedRouterParams(event, validateCategoryIdParams)
  const { name, slug } = await readValidatedBody(event, validateCategoryMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [updatedCategory] = await transaction
        .update(equipmentCategories)
        .set({
          name,
          slug
        })
        .where(
          eq(categoryBaseSelection.id, categoryId)
        )
        .returning(categoryBaseSelection)

      if (updatedCategory === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'update_category',
          targetId: `${updatedCategory.id}`,

          metadata: {
            name: updatedCategory.name,
            slug: updatedCategory.slug
          }
        })

      return updatedCategory
    })
  } catch (error) {
    throwCategoryWriteError(error, 'update')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close category write database client', { error })
    }
  }
})
