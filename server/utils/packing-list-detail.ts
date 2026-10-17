import { createError } from 'nuxt/server'
import { readMyGear, type MyGearRecord } from '#server/utils/my-gear'
import type { createHttpClient } from '#server/utils/database'

import {
  createPackingListEntry,
  createPackingListInventory,
  type PackingListEntry
} from '#server/utils/packing-list-entry'

type PackingListReadDatabase = Pick<ReturnType<typeof createHttpClient>, 'query' | 'select'>

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
  personalName: string | null;
  id: string;
  item: PackingListEntryItem | null;
}

interface PackingListEntryRow {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  quantity: number;
  customWeightGrams: string | null;
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

function createEntryResponse(entry: PackingListEntryRow, weights: Map<string, MyGearRecord>): PackingListEntry {
  const gear = entry.userEquipment

  const inventory = gear === null ? null : createPackingListInventory({
    brand: gear.item?.brand?.name ?? null,
    category: gear.item?.category?.name ?? null,
    customName: gear.customName,
    personalName: gear.personalName,
    inventoryId: gear.id,
    itemName: gear.item?.name ?? null
  })

  const savedGear = gear === null ? null : weights.get(gear.id)

  if (savedGear === undefined) {
    throw createError({ status: 404 })
  }

  return createPackingListEntry(entry, inventory, savedGear)
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
          quantity: true,
          customWeightGrams: true,
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
              personalName: true,
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

  const inventoryIds = packingList.entries.flatMap(entry => entry.userEquipment === null ? [] : [entry.userEquipment.id])
  const gear = inventoryIds.length === 0 ? [] : await readMyGear(database, userId, inventoryIds)
  const weights = new Map(gear.map(record => [record.id, record]))
  const entries = packingList.entries.map(entry => createEntryResponse(entry, weights))

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
