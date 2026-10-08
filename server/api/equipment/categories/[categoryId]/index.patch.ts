import type { InferInput } from 'valibot'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { logCategoryWriteError, throwCategoryWriteError } from '#server/utils/equipment/category-write-errors'

import {
  validateCategoryScopedParams,
  validateCategoryMutationBody,
  type categoryMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof categoryMutationSchema>; }>): Promise<CategoryBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { categoryId } = await getValidatedRouteParams(event, validateCategoryScopedParams)
  const { name, slug } = await readValidatedBody(event, validateCategoryMutationBody)
  const dbWebsocket = createRuntimeWebSocketClient()

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
      logCategoryWriteError('Failed to close category write database client', error)
    }
  }
})
