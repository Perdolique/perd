import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateSessionUser } from '#server/utils/session'
import { validateItemDetailParams } from '#server/utils/validation/schemas'

interface EquipmentItemGalleryImage {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

interface EquipmentItemGalleryRow {
  images: EquipmentItemGalleryImage[];
}

export default defineEventHandler(async (event): Promise<EquipmentItemGalleryImage[]> => {
  await validateSessionUser(event)

  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)

  const item: EquipmentItemGalleryRow | undefined = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      id: true
    },

    where: {
      id,
      status: 'approved'
    },

    with: {
      images: {
        columns: {
          cloudflareImageId: true,
          displayOrder: true,
          id: true
        },

        orderBy: {
          displayOrder: 'asc'
        }
      }
    }
  })

  if (item === undefined) {
    throw createError({ status: 404 })
  }

  return item.images.map((image) => {
    return {
      cloudflareImageId: image.cloudflareImageId,
      displayOrder: image.displayOrder,
      id: image.id
    }
  })
})

export type { EquipmentItemGalleryImage }
