import { and, eq, gt, sql } from 'drizzle-orm'
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
import { validateItemImageParams } from '#server/utils/validation/schemas'

interface EquipmentItemImageRow {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

async function deleteCloudflareImage(
  binding: Env['IMAGES'],
  image: EquipmentItemImageRow,
  itemId: string
): Promise<void> {
  try {
    const imageHandle = binding.hosted.image(image.cloudflareImageId)

    await imageHandle.delete()
  } catch (error) {
    console.error('Failed to delete Cloudflare image', {
      cloudflareImageId: image.cloudflareImageId,
      error,
      imageId: image.id,
      itemId
    })
  }
}

export default defineEventHandler(async (event) : Promise<void> => {
  const userId = await validateAdminUser(event)

  const {
    id: itemId,
    'image-id': imageId
  } = await getValidatedRouterParams(event, validateItemImageParams)

  const imagesBinding = getCloudflareImagesBinding(event)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const deletedImage = await dbWebsocket.transaction(async (transaction) => {
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

      const images: EquipmentItemImageRow[] = await transaction.query.equipmentItemImages.findMany({
        columns: {
          cloudflareImageId: true,
          displayOrder: true,
          id: true
        },

        where: {
          itemId
        },

        orderBy: {
          displayOrder: 'asc'
        }
      })

      const image = images.find((candidateImage) => candidateImage.id === imageId)

      if (image === undefined) {
        throw createError({
          status: 404,
          statusMessage: 'Equipment image not found'
        })
      }

      const maximumDisplayOrder = images.at(-1)?.displayOrder ?? image.displayOrder
      const displayOrderOffset = maximumDisplayOrder + 1

      const [deletedImageRow] = await transaction
        .delete(equipmentItemImages)
        .where(
          and(
            eq(equipmentItemImages.id, imageId),
            eq(equipmentItemImages.itemId, itemId)
          )
        )
        .returning({
          id: equipmentItemImages.id
        })

      if (deletedImageRow === undefined) {
        throw createError({
          status: 500,
          statusMessage: 'Failed to delete equipment image'
        })
      }

      await transaction
        .update(equipmentItemImages)
        .set({
          displayOrder: sql`${equipmentItemImages.displayOrder} + ${displayOrderOffset}`
        })
        .where(
          and(
            eq(equipmentItemImages.itemId, itemId),
            gt(equipmentItemImages.displayOrder, image.displayOrder)
          )
        )

      await transaction
        .update(equipmentItemImages)
        .set({
          displayOrder: sql`${equipmentItemImages.displayOrder} - ${displayOrderOffset} - 1`
        })
        .where(
          and(
            eq(equipmentItemImages.itemId, itemId),
            gt(equipmentItemImages.displayOrder, maximumDisplayOrder)
          )
        )

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'delete_item_image',
          targetId: image.id,

          metadata: {
            cloudflareImageId: image.cloudflareImageId,
            displayOrder: image.displayOrder,
            itemId
          }
        })

      return image
    })

    const imageDeletionPromise = deleteCloudflareImage(imagesBinding, deletedImage, itemId)

    event.waitUntil(imageDeletionPromise)
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    console.error('Failed to delete equipment item image', {
      error,
      imageId,
      itemId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to delete equipment image'
    })
  } finally {
    await dbWebsocket.$client.end()
  }

  setResponseStatus(event, 204)
})
