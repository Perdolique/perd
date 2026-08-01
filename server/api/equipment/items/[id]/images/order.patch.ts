import { eq, sql } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getValidatedRouterParams,
  isError,
  readValidatedBody
} from 'h3'

import {
  contributions,
  equipmentItemImages,
  equipmentItems
} from '#server/database/schema'

import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  validateItemDetailParams,
  validateItemImageOrderBody
} from '#server/utils/validation/schemas'

interface EquipmentItemImageOrderResponse {
  imageIds: string[];
}

export default defineEventHandler(async (event) : Promise<EquipmentItemImageOrderResponse> => {
  const userId = await validateAdminUser(event)
  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)
  const { imageIds } = await readValidatedBody(event, validateItemImageOrderBody)
  const requestedImageIds = new Set(imageIds)
  const hasDuplicateImageIds = requestedImageIds.size !== imageIds.length

  if (hasDuplicateImageIds) {
    throw createError({
      status: 400,
      statusMessage: 'Image IDs must be unique'
    })
  }

  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [lockedItem] = await transaction
        .select({
          id: equipmentItems.id
        })
        .from(equipmentItems)
        .where(
          eq(equipmentItems.id, itemId)
        )
        .limit(1)
        .for('update')

      if (lockedItem === undefined) {
        throw createError({
          status: 404,
          statusMessage: 'Equipment item not found'
        })
      }

      const images = await transaction.query.equipmentItemImages.findMany({
        columns: {
          id: true
        },

        where: {
          itemId
        },

        orderBy: {
          displayOrder: 'asc'
        }
      })

      const hasEveryImage = images.length === imageIds.length
        && images.every((image) => requestedImageIds.has(image.id))

      if (hasEveryImage === false) {
        throw createError({
          status: 400,
          statusMessage: 'Image order must include every item image exactly once'
        })
      }

      if (imageIds.length > 0) {
        await transaction
          .update(equipmentItemImages)
          .set({
            displayOrder: sql`${equipmentItemImages.displayOrder} + ${imageIds.length}`
          })
          .where(
            eq(equipmentItemImages.itemId, itemId)
          )

        const displayOrderCases = imageIds.map(
          (imageId, displayOrder) => sql`when ${equipmentItemImages.id} = ${imageId} then ${displayOrder}`
        )
        const caseSeparator = sql.raw(' ')
        const joinedDisplayOrderCases = sql.join(displayOrderCases, caseSeparator)
        const displayOrder = sql<number>`cast(case ${joinedDisplayOrderCases} end as integer)`

        await transaction
          .update(equipmentItemImages)
          .set({
            displayOrder
          })
          .where(
            eq(equipmentItemImages.itemId, itemId)
          )
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'reorder_item_images',
          targetId: itemId,

          metadata: {
            imageIds
          }
        })

      return {
        imageIds
      }
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    console.error('Failed to reorder equipment images', {
      error,
      itemId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to reorder equipment images'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
