import { defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { validateItemDetailParams } from '#server/utils/validation/schemas'

interface EquipmentItemImageResponse {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

interface EquipmentItemImageRow {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

export default defineEventHandler(async (event) : Promise<EquipmentItemImageResponse[]> => {
  await validateAdminUser(event)

  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)

  const images: EquipmentItemImageRow[] = await event.context.dbHttp.query.equipmentItemImages.findMany({
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

  return images.map((image) => {
    return {
      cloudflareImageId: image.cloudflareImageId,
      displayOrder: image.displayOrder,
      id: image.id
    }
  })
})
