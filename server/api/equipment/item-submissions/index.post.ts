import type { InferInput } from 'valibot'

import {
  createError,
  defineEventHandler,
  isNuxtError,
  readValidatedBody,
  setResponseStatus,
  type RequestEvent
} from 'nuxt/server'

import type { ApiRequestEvent } from '#shared/types/api-request'
import { contributions, equipmentItems, itemPropertyValues } from '#server/database/schema'
import { getItemSubmissionRateLimiterBinding } from '#server/utils/cloudflare'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { checkPropertiesRevision, lockPropertiesCategories } from '#server/utils/equipment/category-properties'
import { normalizeEquipmentItemProperties } from '#server/utils/equipment/item-properties'
import { validateRegisteredUserAccess } from '#server/utils/user'
import { validateItemSubmissionCreateBody, type itemSubmissionCreateBodySchema } from '#server/utils/validation/schemas'

interface ItemSubmissionCreateResponse {
  id: string;
  status: 'pending';
}

const itemSubmissionOperation = 'submit_equipment_item'

async function getItemSubmissionRateLimitOutcome(
  event: RequestEvent,
  userId: string
): Promise<RateLimitOutcome> {
  try {
    const binding = getItemSubmissionRateLimiterBinding(event)
    const key = `${itemSubmissionOperation}:user:${userId}`

    // Workers Rate Limiting is permissive, eventually consistent, and location-local spam protection, not a strict global quota.
    return await binding.limit({ key })
  } catch (error) {
    console.error({
      error,
      event: 'rate_limit_failed',
      operation: itemSubmissionOperation,
      userId
    })

    throw createError({
      cause: error,
      status: 503,
      statusText: 'Item submission is temporarily unavailable'
    })
  }
}

async function enforceItemSubmissionRateLimit(event: RequestEvent, userId: string): Promise<void> {
  const outcome = await getItemSubmissionRateLimitOutcome(event, userId)

  if (outcome.success === false) {
    console.warn({
      event: 'rate_limit_rejected',
      operation: itemSubmissionOperation,
      userId
    })

    event.res.headers.set('Retry-After', '60')

    throw createError({
      status: 429,
      statusText: 'Too many item submission attempts'
    })
  }
}

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof itemSubmissionCreateBodySchema>; }>): Promise<ItemSubmissionCreateResponse> => {
  const { isAdmin, userId } = await validateRegisteredUserAccess(event)
  const body = await readValidatedBody(event, validateItemSubmissionCreateBody)

  if (isAdmin === false) {
    await enforceItemSubmissionRateLimit(event, userId)
  }

  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    const createdSubmission = await dbWebsocket.transaction(async (transaction) => {
      const [lockedCategory] = await lockPropertiesCategories(transaction, [body.categoryId])

      if (body.expectedPropertiesRevision !== undefined && lockedCategory !== undefined) {
        checkPropertiesRevision(lockedCategory.propertiesRevision, body.expectedPropertiesRevision)
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

      const normalizedProperties = normalizeEquipmentItemProperties(
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
          sourceUrl: body.sourceUrl,
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
    const isExpectedClientError = isNuxtError(error)
      && error.status < 500

    if (isExpectedClientError) {
      throw error
    }

    console.error('Failed to submit equipment item', error)

    throw createError({
      status: 500,
      message: 'Failed to submit equipment item'
    })
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close item submission database client', error)
    }
  }
})

export type { ItemSubmissionCreateResponse }
