import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { createWebSocketClient } from '#server/utils/database'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'

import {
  validateCategoryIdParams,
  validateCategoryMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: categoryId } = await getValidatedRouterParams(event, validateCategoryIdParams)
  const { name, slug } = await readValidatedBody(event, validateCategoryMutationBody)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const dbWrite = createWebSocketClient(databaseConfig)

  try {
    return await dbWrite.transaction(async (transaction) => {
      const updatedCategoryRows: CategoryBaseRecord[] = await transaction
        .update(equipmentCategories)
        .set({
          name,
          slug
        })
        .where(
          eq(categoryBaseSelection.id, categoryId)
        )
        .returning(categoryBaseSelection)

      const [updatedCategory] = updatedCategoryRows

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
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to update category'
    })
  } finally {
    await dbWrite.$client.end()
  }
})
