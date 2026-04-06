import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'
import { contributions, equipmentCategories } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { createWebSocketClient } from '#server/utils/database'
import { categoryBaseSelection, type CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { validateCategoryMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateCategoryMutationBody)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const dbWrite = createWebSocketClient(databaseConfig)

  try {
    const createdCategory = await dbWrite.transaction(async (transaction) => {
      const createdCategoryRows: CategoryBaseRecord[] = await transaction
        .insert(equipmentCategories)
        .values({
          name,
          slug
        })
        .returning(categoryBaseSelection)

      const [newCategory] = createdCategoryRows

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
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to create category'
    })
  } finally {
    await dbWrite.$client.end()
  }
})
