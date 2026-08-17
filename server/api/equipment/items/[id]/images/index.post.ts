import { eq, max } from 'drizzle-orm'

import {
  createError,
  defineEventHandler,
  getRequestWebStream,
  getValidatedQuery,
  getValidatedRouterParams,
  isError,
  setResponseStatus
} from 'h3'

import { contributions, equipmentItemImages, equipmentItems } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage,
  validateEquipmentItemImageRequest
} from '#server/utils/equipment/item-images'

import { validateItemDetailParams, validateItemImageUploadQuery } from '#server/utils/validation/schemas'

interface EquipmentItemImageResponse {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

export default defineEventHandler(async (event) : Promise<EquipmentItemImageResponse> => {
  const userId = await validateAdminUser(event)
  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)
  const { filename } = await getValidatedQuery(event, validateItemImageUploadQuery)
  const mediaType = validateEquipmentItemImageRequest(event)

  const item = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      id: true
    },

    where: {
      id: itemId
    }
  })

  if (item === undefined) {
    throw createError({
      status: 404,
      statusMessage: 'Equipment item not found'
    })
  }

  const imagesBinding = getCloudflareImagesBinding(event)

  const imageBody = await createEquipmentItemImageBody({
    mediaType,
    stream: getRequestWebStream(event)
  })

  const cloudflareImageId = await uploadHostedEquipmentImage({
    binding: imagesBinding,
    body: imageBody,
    creator: userId,
    filename,

    metadata: {
      itemId
    },

    requireSignedURLs: false
  })

  let dbWebsocket: ReturnType<typeof createWebSocketClientFromEvent> | null = null

  try {
    dbWebsocket = createWebSocketClientFromEvent(event)

    const createdImage = await dbWebsocket.transaction(async (transaction) => {
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

      const maximumDisplayOrder = max(equipmentItemImages.displayOrder)

      const [displayOrderRow] = await transaction
        .select({
          displayOrder: maximumDisplayOrder
        })
        .from(equipmentItemImages)
        .where(
          eq(equipmentItemImages.itemId, itemId)
        )

      const previousDisplayOrder = displayOrderRow?.displayOrder ?? -1
      const displayOrder = previousDisplayOrder + 1

      const [newImage] = await transaction
        .insert(equipmentItemImages)
        .values({
          cloudflareImageId,
          displayOrder,
          itemId
        })
        .returning({
          cloudflareImageId: equipmentItemImages.cloudflareImageId,
          displayOrder: equipmentItemImages.displayOrder,
          id: equipmentItemImages.id
        })

      if (newImage === undefined) {
        throw createError({
          status: 500,
          statusMessage: 'Failed to save equipment item image'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'add_item_image',
          targetId: newImage.id,

          metadata: {
            cloudflareImageId: newImage.cloudflareImageId,
            displayOrder: newImage.displayOrder
          }
        })

      return newImage
    })

    setResponseStatus(event, 201)

    return createdImage
  } catch (error) {
    await deleteUnattachedHostedEquipmentImage({
      binding: imagesBinding,
      cloudflareImageId
    })

    if (isError(error)) {
      throw error
    }

    console.error('Failed to save equipment item image', {
      cloudflareImageId,
      error,
      itemId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to save equipment item image'
    })
  } finally {
    await dbWebsocket?.$client.end()
  }
})
