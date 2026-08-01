import { eq, max } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getValidatedRouterParams,
  isError,
  setResponseStatus
} from 'h3'

import {
  contributions,
  equipmentItemImages,
  equipmentItems
} from '#server/database/schema'

import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  createEquipmentItemImageBody,
  validateEquipmentItemImageRequest,
  type EquipmentItemImageBody
} from '#server/utils/equipment/item-images'

import { validateItemDetailParams } from '#server/utils/validation/schemas'

interface EquipmentItemImageResponse {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

interface UploadEquipmentItemImageOptions {
  binding: Env['IMAGES'];
  body: EquipmentItemImageBody;
  itemId: string;
  userId: string;
}

async function uploadEquipmentItemImage(
  options: UploadEquipmentItemImageOptions
): Promise<string> {
  const { binding, body, itemId, userId } = options

  try {
    const image = await binding.hosted.upload(body.stream, {
      creator: userId,

      metadata: {
        itemId
      },

      requireSignedURLs: false
    })

    return image.id
  } catch (error) {
    if (body.isLimitExceeded()) {
      throw createError({
        status: 413,
        statusMessage: 'Image body is too large'
      })
    }

    console.error('Failed to upload Cloudflare image', {
      error,
      itemId
    })

    throw createError({
      status: 502,
      statusMessage: 'Image upload failed'
    })
  } finally {
    await body.close()
  }
}

async function deleteUnattachedImage(
  binding: Env['IMAGES'],
  cloudflareImageId: string
): Promise<void> {
  try {
    const imageHandle = binding.hosted.image(cloudflareImageId)

    await imageHandle.delete()
  } catch (error) {
    console.error('Failed to delete unattached Cloudflare image', {
      cloudflareImageId,
      error
    })
  }
}

export default defineEventHandler(async (event) : Promise<EquipmentItemImageResponse> => {
  const userId = await validateAdminUser(event)
  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)

  validateEquipmentItemImageRequest(event)

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
  const imageBody = await createEquipmentItemImageBody(event)

  const cloudflareImageId = await uploadEquipmentItemImage({
    binding: imagesBinding,
    body: imageBody,
    itemId,
    userId
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
    await deleteUnattachedImage(imagesBinding, cloudflareImageId)

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
