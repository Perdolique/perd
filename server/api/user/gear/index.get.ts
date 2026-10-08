import { defineEventHandler } from 'nuxt/server'
import { throwMyGearError } from '#server/utils/my-gear-errors'
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

interface CatalogMyGearRecord {
  source: 'catalog';
  createdAt: Date | string;
  id: string;
  item: MyGearItem;
}

interface CustomMyGearRecord {
  createdAt: Date | string;
  customName: string;
  id: string;
  source: 'custom';
}

type MyGearRecord = CatalogMyGearRecord | CustomMyGearRecord

interface MyGearQueryRow {
  customName: string | null;
  createdAt: Date | string;
  id: string;
  item: MyGearQueryItem | null;
}

export default defineEventHandler(async (event) : Promise<MyGearRecord[]> => {
  const userId = await validateSessionUser(event)

  try {
    const myGearRows: MyGearQueryRow[] = await event.context.dbHttp.query.userEquipment.findMany({
      columns: {
        customName: true,
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

    const records: MyGearRecord[] = []

    for (const row of myGearRows) {
      const { item } = row

      if (row.customName !== null && item === null) {
        records.push({
          createdAt: row.createdAt,
          customName: row.customName,
          id: row.id,
          source: 'custom'
        })
      } else if (item?.brand && item.category) {
        records.push({
          createdAt: row.createdAt,
          id: row.id,
          source: 'catalog',

          item: {
            id: item.id,
            name: item.name,

            brand: {
              name: item.brand.name,
              slug: item.brand.slug
            },

            category: {
              name: item.category.name,
              slug: item.category.slug
            }
          }
        })
      }
    }

    return records
  } catch (error) {
    throwMyGearError(error, 'load')
  }
})

export type { MyGearRecord, CustomMyGearRecord }
