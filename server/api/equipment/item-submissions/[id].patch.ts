import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import { contributions, equipmentItems, itemPropertyValues } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  checkPropertiesRevision,
  lockPropertiesCategories,
  propertiesConflict
} from '#server/utils/equipment/category-properties'

import { normalizeItemSubmissionProperties } from '#server/utils/equipment/item-submission-properties'
import { validateItemSubmissionParams, validateItemSubmissionUpdateBody } from '#server/utils/validation/schemas'
import type { ItemSubmissionDetailResponse, ItemSubmissionPropertyValue } from './[id].get'

function mapNormalizedProperty(value: {
  propertyId: number;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}): ItemSubmissionPropertyValue {
  if (value.valueBoolean !== null) {
    return {
      propertyId: value.propertyId,
      value: value.valueBoolean
    }
  }

  const stringValue = value.valueNumber ?? value.valueText

  if (stringValue === null) {
    throw new Error(`Normalized equipment property ${value.propertyId} has no value`)
  }

  return {
    propertyId: value.propertyId,
    value: stringValue
  }
}

export default defineEventHandler(async (event): Promise<ItemSubmissionDetailResponse> => {
  const userId = await validateAdminUser(event)
  const { id } = await getValidatedRouterParams(event, validateItemSubmissionParams)
  const body = await readValidatedBody(event, validateItemSubmissionUpdateBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const original = await transaction.query.equipmentItems.findFirst({
        columns: {
          categoryId: true
        },

        where: {
          id
        }
      })

      if (original === undefined) {
        throw createError({ status: 404 })
      }

      const lockedCategories = await lockPropertiesCategories(transaction, [original.categoryId, body.categoryId])
      const originalCategory = lockedCategories.find((category) => category.id === original.categoryId)
      const selectedCategory = lockedCategories.find((category) => category.id === body.categoryId)

      if (originalCategory === undefined || selectedCategory === undefined) {
        throw createError({ status: 404 })
      }

      checkPropertiesRevision(originalCategory.propertiesRevision, body.expectedOriginalPropertiesRevision)
      checkPropertiesRevision(selectedCategory.propertiesRevision, body.expectedPropertiesRevision)

      const [item] = await transaction
        .select({
          categoryId: equipmentItems.categoryId,
          createdAt: equipmentItems.createdAt,
          createdBy: equipmentItems.createdBy,
          id: equipmentItems.id,
          sourceUrl: equipmentItems.sourceUrl,
          status: equipmentItems.status,
          updatedAt: equipmentItems.updatedAt
        })
        .from(equipmentItems)
        .where(eq(equipmentItems.id, id))
        .limit(1)
        .for('update')

      if (item === undefined) {
        throw createError({ status: 404 })
      }

      if (item.categoryId !== original.categoryId) {
        throw propertiesConflict('submission_category_conflict', 'The submission category changed. Reload before continuing.')
      }

      if (item.status !== 'pending') {
        throw createError({
          status: 409,
          message: 'Equipment item submission is no longer pending'
        })
      }

      const expectedUpdatedAt = new Date(body.expectedUpdatedAt)

      if (item.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw createError({
          status: 409,
          message: 'Equipment item submission changed since it was loaded'
        })
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

      const authorPromise = item.createdBy === null
        ? null
        : transaction.query.users.findFirst({
            columns: {
              id: true,
              name: true
            },

            where: {
              id: item.createdBy
            }
          })

      const [brand, category, author] = await Promise.all([
        brandPromise,
        categoryPromise,
        authorPromise
      ])

      if (brand === undefined || category === undefined) {
        throw createError({ status: 404 })
      }

      const normalizedProperties = normalizeItemSubmissionProperties(
        body.categoryId,
        category.properties,
        body.properties
      )

      let status: 'approved' | 'pending' | 'rejected' = 'pending'

      if (body.decision === 'publish') {
        status = 'approved'
      } else if (body.decision === 'reject') {
        status = 'rejected'
      }

      const rejectionReason = body.decision === 'reject'
        ? body.rejectionReason ?? null
        : null

      let contributionAction = 'update_equipment_item_submission'

      if (body.decision === 'publish') {
        contributionAction = 'publish_item_submission'
      } else if (body.decision === 'reject') {
        contributionAction = 'reject_item_submission'
      }

      const [updatedItem] = await transaction
        .update(equipmentItems)
        .set({
          brandId: body.brandId,
          categoryId: body.categoryId,
          name: body.name,
          rejectionReason,
          status
        })
        .where(eq(equipmentItems.id, id))
        .returning({ updatedAt: equipmentItems.updatedAt })

      if (updatedItem === undefined) {
        throw new Error(`Equipment item ${id} disappeared while it was locked`)
      }

      await transaction
        .delete(itemPropertyValues)
        .where(
          eq(itemPropertyValues.itemId, id)
        )

      if (normalizedProperties.length > 0) {
        const propertyRows = normalizedProperties.map((property) => {
          return {
            itemId: id,
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
          action: contributionAction,

          metadata: {
            brandId: brand.id,
            brandName: brand.name,
            categoryId: category.id,
            categoryName: category.name,
            name: body.name,
            propertyCount: normalizedProperties.length,
            rejectionReason,
            status
          },

          targetId: id,
          userId
        })

      return {
        author: author ?? null,
        brand,
        category,
        createdAt: item.createdAt,
        id,
        name: body.name,
        properties: normalizedProperties.map((property) => mapNormalizedProperty(property)),
        propertiesRevision: selectedCategory.propertiesRevision,
        rejectionReason,
        sourceUrl: item.sourceUrl,
        status,
        updatedAt: updatedItem.updatedAt
      }
    })
  } catch (error) {
    const isExpectedClientError = isError(error) && error.statusCode < 500

    if (isExpectedClientError) {
      throw error
    }

    console.error('Failed to update equipment item submission', error)

    throw createError({
      status: 500,
      message: 'Failed to update equipment item submission'
    })
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close item review database client', error)
    }
  }
})
