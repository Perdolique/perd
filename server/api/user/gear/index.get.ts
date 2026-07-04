import { defineEventHandler } from 'h3'
import { validateSessionUser } from '#server/utils/session'

interface MyGearItemBrand {
  name: string;
  slug: string;
}

interface MyGearItemCategory {
  name: string;
  slug: string;
}

interface MyGearItem {
  brand: MyGearItemBrand;
  category: MyGearItemCategory;
  id: string;
  name: string;
}

interface MyGearQueryItem {
  brand: MyGearItemBrand | null;
  category: MyGearItemCategory | null;
  id: string;
  name: string;
}

interface MyGearRecord {
  createdAt: Date | string;
  id: string;
  item: MyGearItem;
}

interface MyGearQueryRow {
  createdAt: Date | string;
  id: string;
  item: MyGearQueryItem | null;
}

export default defineEventHandler(async (event) : Promise<MyGearRecord[]> => {
  const userId = await validateSessionUser(event)

  const myGearRows: MyGearQueryRow[] = await event.context.dbHttp.query.userEquipment.findMany({
    columns: {
      createdAt: true,
      id: true
    },

    where: {
      userId
    },

    orderBy: {
      createdAt: 'desc',
      id: 'desc'
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

  const completeMyGearRows = myGearRows.filter(
    (row): row is MyGearRecord => row.item !== null && row.item.brand !== null && row.item.category !== null
  )

  return completeMyGearRows
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
