import { createError } from 'nuxt/server'
import type { createHttpClient } from '#server/utils/database'

import {
  createPackingListEntry,
  createPackingListInventory,
  type PackingListEntry
} from '#server/utils/packing-list-entry'

type PackingListReadDatabase = Pick<ReturnType<typeof createHttpClient>, 'query'>

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
  customName: string | null;
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

function createEntryResponse(entry: PackingListEntryRow): PackingListEntry {
  const gear = entry.userEquipment

  const inventory = gear === null ? null : createPackingListInventory({
    brand: gear.item?.brand?.name ?? null,
    category: gear.item?.category?.name ?? null,
    customName: gear.customName,
    inventoryId: gear.id,
    itemName: gear.item?.name ?? null
  })

  return createPackingListEntry(entry, inventory)
}

async function readPackingListDetail(database: PackingListReadDatabase, id: string, userId: string): Promise<PackingListDetail> {
  const packingList: PackingListQueryDetail | undefined = await database.query.packingLists.findFirst({
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

        orderBy: {
          createdAt: 'asc',
          id: 'asc'
        },

        with: {
          userEquipment: {
            columns: {
              customName: true,
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

  const entries = packingList.entries.map(createEntryResponse)

  return {
    createdAt: packingList.createdAt,
    entries,
    id: packingList.id,
    name: packingList.name,
    updatedAt: packingList.updatedAt
  }
}

export { readPackingListDetail }
export type { PackingListDetail }
