import { and, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'

import {
  categoryProperties,
  contributions,
  equipmentItems,
  itemPropertyValues
} from '#server/database/schema'

import { createWebSocketClientFromEvent } from '#server/utils/config'
import { normalizeItemSubmissionProperties } from '#server/utils/equipment/item-submission-properties'
import { validateRegisteredUser } from '#server/utils/user'
import { validateItemSubmissionCreateBody } from '#server/utils/validation/schemas'

interface ItemSubmissionCreateResponse {
  id: string;
  status: 'pending';
}

export default defineEventHandler(async (event): Promise<ItemSubmissionCreateResponse> => {
  const userId = await validateRegisteredUser(event)
  const body = await readValidatedBody(event, validateItemSubmissionCreateBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const createdSubmission = await dbWebsocket.transaction(async (transaction) => {
      const submittedPropertyIds = body.properties.map((property) => property.propertyId)

      if (submittedPropertyIds.length > 0) {
        await transaction
          .select({
            id: categoryProperties.id
          })
          .from(categoryProperties)
          .where(
            and(
              eq(categoryProperties.categoryId, body.categoryId),
              inArray(categoryProperties.id, submittedPropertyIds)
            )
          )
          .for('key share')
      }

      const brandPromise = transaction.query.brands.findFirst({
        columns: {
          id: true,
          name: true
        },

        where: {
          id: body.brandId
        }
      })

      const categoryPromise = transaction.query.equipmentCategories.findFirst({
        columns: {
          id: true,
          name: true
        },

        where: {
          id: body.categoryId
        },

        with: {
          properties: {
            columns: {
              allowsNegativeValues: true,
              categoryId: true,
              dataType: true,
              id: true
            },

            with: {
              enumOptions: {
                columns: {
                  slug: true
                }
              }
            }
          }
        }
      })

      const [brand, category] = await Promise.all([
        brandPromise,
        categoryPromise
      ])

      if (brand === undefined || category === undefined) {
        throw createError({ status: 404 })
      }

      const normalizedProperties = normalizeItemSubmissionProperties(
        body.categoryId,
        category.properties,
        body.properties
      )

      const [createdItem] = await transaction
        .insert(equipmentItems)
        .values({
          brandId: body.brandId,
          categoryId: body.categoryId,
          createdBy: userId,
          name: body.name,
          status: 'pending'
        })
        .returning({
          id: equipmentItems.id
        })

      if (createdItem === undefined) {
        throw new Error('Equipment item insert returned no row')
      }

      if (normalizedProperties.length > 0) {
        const propertyRows = normalizedProperties.map((property) => {
          return {
            itemId: createdItem.id,
            propertyId: property.propertyId,
            valueBoolean: property.valueBoolean,
            valueNumber: property.valueNumber,
            valueText: property.valueText
          }
        })

        await transaction
          .insert(itemPropertyValues)
          .values(propertyRows)
      }

      await transaction
        .insert(contributions)
        .values({
          action: 'submit_equipment_item',

          metadata: {
            brandId: brand.id,
            brandName: brand.name,
            categoryId: category.id,
            categoryName: category.name,
            name: body.name,
            propertyCount: normalizedProperties.length,
            status: 'pending'
          },

          targetId: createdItem.id,
          userId
        })

      return {
        id: createdItem.id,
        status: 'pending' as const
      }
    })

    setResponseStatus(event, 201)

    return createdSubmission
  } catch (error) {
    const isExpectedClientError = isError(error)
      && error.statusCode < 500

    if (isExpectedClientError) {
      throw error
    }

    console.error('Failed to submit equipment item', error)

    throw createError({
      status: 500,
      message: 'Failed to submit equipment item'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})

export type { ItemSubmissionCreateResponse }
