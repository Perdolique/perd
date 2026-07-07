import { and, eq, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import {
  brands,
  equipmentCategories,
  equipmentItems,
  packingListEntries,
  packingLists,
  userEquipment
} from '#server/database/schema'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { validateSessionUser } from '#server/utils/session'

import {
  validatePackingListEntryParams,
  validatePackingListEntryUpdateBody
} from '#server/utils/validation/schemas'

interface PackingListEntryInventory {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntryBase {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: Date | string;
}

interface PackingListCustomEntry extends PackingListEntryBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryBase {
  inventory: PackingListEntryInventory;
  source: 'inventory';
}

type PackingListEntry = PackingListCustomEntry | PackingListInventoryEntry

interface PackingListEntryInventoryRow {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntryMutationResponse {
  entry: PackingListEntry;
  packingListUpdatedAt: Date | string;
}

function createCustomEntryResponse(entry: {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: Date | string;
}) : PackingListEntry {
  return {
    createdAt: entry.createdAt,
    customName: entry.customName,
    id: entry.id,
    isPacked: entry.isPacked,
    source: 'custom',
    updatedAt: entry.updatedAt
  }
}

function createInventoryEntryResponse(
  entry: {
    createdAt: Date | string;
    customName: string | null;
    id: string;
    isPacked: boolean;
    updatedAt: Date | string;
  },
  inventory: PackingListEntryInventoryRow
) : PackingListEntry {
  return {
    createdAt: entry.createdAt,
    customName: entry.customName,
    id: entry.id,

    inventory: {
      brand: inventory.brand,
      category: inventory.category,
      inventoryId: inventory.inventoryId,
      itemName: inventory.itemName
    },

    isPacked: entry.isPacked,
    source: 'inventory',
    updatedAt: entry.updatedAt
  }
}

export default defineEventHandler(async (event) : Promise<PackingListEntryMutationResponse> => {
  const userId = await validateSessionUser(event)
  const { entryId, id } = await getValidatedRouterParams(event, validatePackingListEntryParams)
  const { isPacked } = await readValidatedBody(event, validatePackingListEntryUpdateBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [ownedList] = await transaction
        .select({
          id: packingLists.id
        })
        .from(packingLists)
        .where(
          and(
            eq(packingLists.id, id),
            eq(packingLists.userId, userId)
          )
        )
        .limit(1)

      if (ownedList === undefined) {
        throw createError({ status: 404 })
      }

      const [updatedEntry] = await transaction
        .update(packingListEntries)
        .set({
          isPacked
        })
        .where(
          and(
            eq(packingListEntries.id, entryId),
            eq(packingListEntries.packingListId, id)
          )
        )
        .returning({
          createdAt: packingListEntries.createdAt,
          customName: packingListEntries.customName,
          id: packingListEntries.id,
          isPacked: packingListEntries.isPacked,
          updatedAt: packingListEntries.updatedAt,
          userEquipmentId: packingListEntries.userEquipmentId
        })

      if (updatedEntry === undefined) {
        throw createError({ status: 404 })
      }

      let inventoryRow: PackingListEntryInventoryRow | null = null

      if (updatedEntry.userEquipmentId !== null) {
        const [ownedInventoryRow] = await transaction
          .select({
            brand: brands.name,
            category: equipmentCategories.name,
            inventoryId: userEquipment.id,
            itemName: equipmentItems.name
          })
          .from(userEquipment)
          .innerJoin(equipmentItems, eq(userEquipment.itemId, equipmentItems.id))
          .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
          .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
          .where(
            and(
              eq(userEquipment.id, updatedEntry.userEquipmentId),
              eq(userEquipment.userId, userId)
            )
          )
          .limit(1)

        if (ownedInventoryRow === undefined) {
          throw createError({ status: 404 })
        }

        inventoryRow = ownedInventoryRow
      }

      const entryResponse = inventoryRow === null
        ? createCustomEntryResponse(updatedEntry)
        : createInventoryEntryResponse(updatedEntry, inventoryRow)

      const [updatedList] = await transaction
        .update(packingLists)
        .set({
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(packingLists.id, id),
            eq(packingLists.userId, userId)
          )
        )
        .returning({
          updatedAt: packingLists.updatedAt
        })

      if (updatedList === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to touch packing list'
        })
      }

      return {
        entry: entryResponse,
        packingListUpdatedAt: updatedList.updatedAt
      }
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to update packing list entry'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
