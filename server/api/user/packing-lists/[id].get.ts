import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import type { AnyColumn, SQL } from 'drizzle-orm'
import type { packingListEntries } from '#server/database/schema'
import { validatePackingListIdParams } from '#server/utils/validation/schemas'
import { validateSessionUser } from '#server/utils/session'

interface PackingListEntryInventory {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntry {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  inventory?: PackingListEntryInventory;
  isPacked: boolean;
  source: 'custom' | 'inventory';
  updatedAt: Date | string;
}

interface PackingListEntryItemBrand {
  name: string;
}

interface PackingListEntryItemCategory {
  name: string;
}

interface PackingListEntryItem {
  brand: PackingListEntryItemBrand | null;
  category: PackingListEntryItemCategory | null;
  name: string;
}

interface PackingListEntryUserEquipment {
  id: string;
  item: PackingListEntryItem | null;
}

interface PackingListEntryRow {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: Date | string;
  userEquipment: PackingListEntryUserEquipment | null;
}

interface PackingListDetail {
  createdAt: Date | string;
  entries: PackingListEntry[];
  id: string;
  name: string;
  updatedAt: Date | string;
}

interface PackingListQueryDetail {
  createdAt: Date | string;
  entries: PackingListEntryRow[];
  id: string;
  name: string;
  updatedAt: Date | string;
}

function createPackingListEntry(entry: PackingListEntryRow): PackingListEntry {
  if (entry.userEquipment === null) {
    return {
      createdAt: entry.createdAt,
      customName: entry.customName,
      id: entry.id,
      isPacked: entry.isPacked,
      source: 'custom',
      updatedAt: entry.updatedAt
    }
  }

  const inventoryItem = entry.userEquipment.item

  if (inventoryItem === null) {
    return {
      createdAt: entry.createdAt,
      customName: entry.customName,
      id: entry.id,
      isPacked: entry.isPacked,
      source: 'custom',
      updatedAt: entry.updatedAt
    }
  }

  const { brand, category, name } = inventoryItem

  if (brand === null || category === null) {
    return {
      createdAt: entry.createdAt,
      customName: entry.customName,
      id: entry.id,
      isPacked: entry.isPacked,
      source: 'custom',
      updatedAt: entry.updatedAt
    }
  }

  return {
    createdAt: entry.createdAt,
    customName: entry.customName,
    id: entry.id,

    inventory: {
      brand: brand.name,
      category: category.name,
      inventoryId: entry.userEquipment.id,
      itemName: name
    },

    isPacked: entry.isPacked,
    source: 'inventory',
    updatedAt: entry.updatedAt
  }
}

export default defineEventHandler(async (event) : Promise<PackingListDetail> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)

  const packingList: PackingListQueryDetail | undefined = await event.context.dbHttp.query.packingLists.findFirst({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      updatedAt: true
    },

    where: {
      id,
      userId
    },

    with: {
      entries: {
        columns: {
          createdAt: true,
          customName: true,
          id: true,
          isPacked: true,
          updatedAt: true
        },

        orderBy: (entries: typeof packingListEntries, { asc }: { asc: (column: AnyColumn) => SQL }) => [
          asc(entries.createdAt),
          asc(entries.id)
        ],

        with: {
          userEquipment: {
            columns: {
              id: true
            },

            with: {
              item: {
                columns: {
                  name: true
                },

                with: {
                  brand: {
                    columns: {
                      name: true
                    }
                  },

                  category: {
                    columns: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  if (packingList === undefined) {
    throw createError({ status: 404 })
  }

  return {
    createdAt: packingList.createdAt,
    entries: packingList.entries.map(createPackingListEntry),
    id: packingList.id,
    name: packingList.name,
    updatedAt: packingList.updatedAt
  }
})
