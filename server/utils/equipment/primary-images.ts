import type { createHttpClient } from '#server/utils/database'

type DbHttp = ReturnType<typeof createHttpClient>

interface PrimaryEquipmentImageIdsOptions {
  dbHttp: DbHttp;
  itemIds: string[];
}

/** Loads primary Cloudflare image IDs in one batch and indexes them by item ID. */
async function getPrimaryEquipmentImageIds(
  options: PrimaryEquipmentImageIdsOptions
): Promise<Map<string, string>> {
  const { dbHttp, itemIds } = options

  if (itemIds.length === 0) {
    return new Map()
  }

  const rows = await dbHttp.query.equipmentItemImages.findMany({
    columns: {
      cloudflareImageId: true,
      itemId: true
    },

    where: {
      displayOrder: 0,

      itemId: {
        in: itemIds
      }
    }
  })

  const imageIdsByItemId = new Map<string, string>()

  for (const row of rows) {
    imageIdsByItemId.set(row.itemId, row.cloudflareImageId)
  }

  return imageIdsByItemId
}

export {
  getPrimaryEquipmentImageIds
}
