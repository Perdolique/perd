import { defineEventHandler } from 'h3'
import { validateSessionUser } from '#server/utils/session'

interface InventoryItemBrand {
  name: string;
  slug: string;
}

interface InventoryItemCategory {
  name: string;
  slug: string;
}

interface InventoryItem {
  brand: InventoryItemBrand;
  category: InventoryItemCategory;
  id: string;
  name: string;
}

interface InventoryQueryItem {
  brand: InventoryItemBrand | null;
  category: InventoryItemCategory | null;
  id: string;
  name: string;
}

interface InventoryRecord {
  createdAt: Date | string;
  id: string;
  item: InventoryItem;
}

interface InventoryQueryRow {
  createdAt: Date | string;
  id: string;
  item: InventoryQueryItem | null;
}

export default defineEventHandler(async (event) : Promise<InventoryRecord[]> => {
  const userId = await validateSessionUser(event)

  const inventoryRows: InventoryQueryRow[] = await event.context.dbHttp.query.userEquipment.findMany({
    columns: {
      createdAt: true,
      id: true
    },

    where: {
      userId
    },

    with: {
      item: {
        columns: {
          id: true,
          name: true
        },

        with: {
          brand: {
            columns: {
              name: true,
              slug: true
            }
          },

          category: {
            columns: {
              name: true,
              slug: true
            }
          }
        }
      }
    }
  })

  const completeInventoryRows = inventoryRows.filter(
    (row): row is InventoryRecord => row.item !== null && row.item.brand !== null && row.item.category !== null
  )

  return completeInventoryRows
    .toSorted((leftRow, rightRow) => {
      const createdAtDifference = new Date(rightRow.createdAt).getTime() - new Date(leftRow.createdAt).getTime()

      if (createdAtDifference !== 0) {
        return createdAtDifference
      }

      return rightRow.id.localeCompare(leftRow.id)
    })
    .map((row) => {
      return {
        createdAt: row.createdAt,
        id: row.id,

        item: {
          id: row.item.id,
          name: row.item.name,

          brand: {
            name: row.item.brand.name,
            slug: row.item.brand.slug
          },

          category: {
            name: row.item.category.name,
            slug: row.item.category.slug
          }
        }
      }
    })
})
