import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody, setResponseStatus } from 'h3'
import { categoryProperties, contributions, propertyEnumOptions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { propertyEnumOptionBaseSelection } from '#server/utils/equipment/base-records'

import {
  validateCategoryPropertyParams,
  validatePropertyEnumOptionMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { categoryId, propertyId } = await getValidatedRouterParams(event, validateCategoryPropertyParams)
  const { name, slug } = await readValidatedBody(event, validatePropertyEnumOptionMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const createdOption = await dbWebsocket.transaction(async (transaction) => {
      const [currentProperty] = await transaction
        .select({
          id: categoryProperties.id,
          dataType: categoryProperties.dataType
        })
        .from(categoryProperties)
        .where(
          and(
            eq(categoryProperties.categoryId, categoryId),
            eq(categoryProperties.id, propertyId)
          )
        )
        .limit(1)

      if (currentProperty === undefined) {
        throw createError({ status: 404 })
      }

      if (currentProperty.dataType !== 'enum') {
        throw createError({
          status: 400,
          message: 'Enum options can only be added to enum properties'
        })
      }

      const [existingOption] = await transaction
        .select({
          id: propertyEnumOptions.id
        })
        .from(propertyEnumOptions)
        .where(
          and(
            eq(propertyEnumOptions.propertyId, propertyId),
            eq(propertyEnumOptions.slug, slug)
          )
        )
        .limit(1)

      if (existingOption !== undefined) {
        throw createError({
          status: 409,
          message: 'Property enum option slug already exists'
        })
      }

      const [newOption] = await transaction
        .insert(propertyEnumOptions)
        .values({
          propertyId,
          name,
          slug
        })
        .returning(propertyEnumOptionBaseSelection)

      if (newOption === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create property enum option'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'create_property_enum_option',
          targetId: `${newOption.id}`,

          metadata: {
            categoryId,
            name: newOption.name,
            propertyId,
            slug: newOption.slug
          }
        })

      return newOption
    })

    setResponseStatus(event, 201)

    return createdOption
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to create property enum option'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
