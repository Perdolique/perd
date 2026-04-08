import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'
import { categoryProperties, contributions, itemPropertyValues, propertyEnumOptions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { propertyEnumOptionBaseSelection } from '#server/utils/equipment/base-records'
import { validatePropertyEnumOptionParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { categoryId, optionId, propertyId } = await getValidatedRouterParams(event, validatePropertyEnumOptionParams)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    await dbWebsocket.transaction(async (transaction) => {
      const [currentOption] = await transaction
        .select(propertyEnumOptionBaseSelection)
        .from(propertyEnumOptions)
        .innerJoin(
          categoryProperties,

          and(
            eq(categoryProperties.id, propertyEnumOptions.propertyId),
            eq(categoryProperties.categoryId, categoryId)
          )
        )
        .where(
          and(
            eq(propertyEnumOptions.id, optionId),
            eq(propertyEnumOptions.propertyId, propertyId)
          )
        )
        .limit(1)

      if (currentOption === undefined) {
        throw createError({ status: 404 })
      }

      const [usedValue] = await transaction
        .select({
          id: itemPropertyValues.id
        })
        .from(itemPropertyValues)
        .where(
          and(
            eq(itemPropertyValues.propertyId, propertyId),
            eq(itemPropertyValues.valueText, currentOption.slug)
          )
        )
        .limit(1)

      if (usedValue !== undefined) {
        throw createError({
          status: 409,
          message: 'Property enum option is already used by item values'
        })
      }

      const [deletedOption] = await transaction
        .delete(propertyEnumOptions)
        .where(
          eq(propertyEnumOptions.id, optionId)
        )
        .returning(propertyEnumOptionBaseSelection)

      if (deletedOption === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'delete_property_enum_option',
          targetId: `${deletedOption.id}`,

          metadata: {
            categoryId,
            name: deletedOption.name,
            propertyId,
            slug: deletedOption.slug
          }
        })
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete property enum option'
    })
  } finally {
    await dbWebsocket.$client.end()
  }

  setResponseStatus(event, 204)
})
