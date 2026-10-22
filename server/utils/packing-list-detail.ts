import { createError } from 'nuxt/server'
import { readMyGear, type MyGearRecord } from '#server/utils/my-gear'
import type { createHttpClient } from '#server/utils/database'
import { createPackingListEntry, type PackingListEntry } from '#server/utils/packing-list-entry'

type PackingListReadDatabase = Pick<ReturnType<typeof createHttpClient>, 'query' | 'select'>

interface PackingListEntryRow {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  quantity: number;
  customWeightGrams: string | null;
  updatedAt: Date | string;
  userEquipmentId: string | null;
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

function createEntryResponse(entry: PackingListEntryRow, gearById: Map<string, MyGearRecord>): PackingListEntry {
  const savedGear = entry.userEquipmentId === null ? null : gearById.get(entry.userEquipmentId)

  if (savedGear === undefined) {
    throw createError({ status: 404 })
  }

  return createPackingListEntry(entry, savedGear)
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
          updatedAt: true,
          userEquipmentId: true
        },

        orderBy: {
          createdAt: 'asc',
          id: 'asc'
        }
      }
    }
  })

  if (packingList === undefined) {
    throw createError({ status: 404 })
  }

  const inventoryIds = packingList.entries.flatMap(entry => entry.userEquipmentId === null ? [] : [entry.userEquipmentId])
  const gear = inventoryIds.length === 0 ? [] : await readMyGear(database, userId, inventoryIds)
  const gearEntries = gear.map((record): [string, MyGearRecord] => [record.id, record])
  const gearById = new Map(gearEntries)
  const entries = packingList.entries.map(entry => createEntryResponse(entry, gearById))

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
