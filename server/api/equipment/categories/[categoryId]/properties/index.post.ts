import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody, setResponseStatus } from 'h3'
import { categoryProperties, contributions, equipmentCategories, propertyEnumOptions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  categoryPropertyBaseSelection,
  propertyEnumOptionBaseSelection
} from '#server/utils/equipment/base-records'

import {
  validateCategoryPropertyMutationBody,
  validateCategoryScopedParams
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { categoryId } = await getValidatedRouterParams(event, validateCategoryScopedParams)
  const { dataType, enumOptions, name, slug, unit } = await readValidatedBody(event, validateCategoryPropertyMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const createdProperty = await dbWebsocket.transaction(async (transaction) => {
      const [existingCategory] = await transaction
        .select({
          id: equipmentCategories.id
        })
        .from(equipmentCategories)
        .where(
          eq(equipmentCategories.id, categoryId)
        )
        .limit(1)

      if (existingCategory === undefined) {
        throw createError({ status: 404 })
      }

      const [duplicateProperty] = await transaction
        .select({
          id: categoryProperties.id
        })
        .from(categoryProperties)
        .where(
          and(
            eq(categoryProperties.categoryId, categoryId),
            eq(categoryProperties.slug, slug)
          )
        )
        .limit(1)

      if (duplicateProperty !== undefined) {
        throw createError({
          status: 409,
          message: 'Category property slug already exists'
        })
      }

      const [newProperty] = await transaction
        .insert(categoryProperties)
        .values({
          categoryId,
          dataType,
          name,
          slug,
          unit
        })
        .returning(categoryPropertyBaseSelection)

      if (newProperty === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create category property'
        })
      }

      const enumValues = enumOptions?.map((option) => {
        return {
          propertyId: newProperty.id,
          name: option.name,
          slug: option.slug
        }
      })

      const createdEnumOptions = enumValues === undefined
        ? undefined
        : await transaction
          .insert(propertyEnumOptions)
          .values(enumValues)
          .returning(propertyEnumOptionBaseSelection)

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'create_category_property',
          targetId: `${newProperty.id}`,

          metadata: {
            categoryId,
            dataType: newProperty.dataType,
            name: newProperty.name,
            slug: newProperty.slug,
            unit: newProperty.unit
          }
        })

      return {
        dataType: newProperty.dataType,
        enumOptions: createdEnumOptions,
        id: newProperty.id,
        name: newProperty.name,
        slug: newProperty.slug,
        unit: newProperty.unit
      }
    })

    setResponseStatus(event, 201)

    return createdProperty
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to create category property'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
