import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'h3'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { throwCategoryWriteError } from '#server/utils/equipment/category-write-errors'
import { validateCategoryMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<CategoryBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateCategoryMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const createdCategory = await dbWebsocket.transaction(async (transaction) => {
      const [newCategory] = await transaction
        .insert(equipmentCategories)
        .values({
          name,
          slug
        })
        .returning(categoryBaseSelection)

      if (newCategory === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create category'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'create_category',
          targetId: `${newCategory.id}`,

          metadata: {
            name: newCategory.name,
            slug: newCategory.slug
          }
        })

      return newCategory
    })

    setResponseStatus(event, 201)

    return createdCategory
  } catch (error) {
    throwCategoryWriteError(error, 'create')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close category write database client', { error })
    }
  }
})
