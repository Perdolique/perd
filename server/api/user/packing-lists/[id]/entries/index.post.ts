import { and, eq, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody, setResponseStatus } from 'h3'
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
  validatePackingListEntryCreateBody,
  validatePackingListIdParams
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

interface PostgresError {
  code?: string;
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

function isUniqueViolation(error: unknown): error is PostgresError {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const postgresError = error as PostgresError

  return postgresError.code === '23505'
}

export default defineEventHandler(async (event) : Promise<PackingListEntryMutationResponse> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)
  const { customName, inventoryId } = await readValidatedBody(event, validatePackingListEntryCreateBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const response = await dbWebsocket.transaction(async (transaction) => {
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

      let inventoryRow: PackingListEntryInventoryRow | null = null

      if (inventoryId !== undefined) {
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
              eq(userEquipment.id, inventoryId),
              eq(userEquipment.userId, userId)
            )
          )
          .limit(1)

        if (ownedInventoryRow === undefined) {
          throw createError({ status: 404 })
        }

        inventoryRow = ownedInventoryRow
      }

      const [createdEntry] = await transaction
        .insert(packingListEntries)
        .values({
          customName,
          packingListId: id,
          userEquipmentId: inventoryId
        })
        .returning({
          createdAt: packingListEntries.createdAt,
          customName: packingListEntries.customName,
          id: packingListEntries.id,
          isPacked: packingListEntries.isPacked,
          updatedAt: packingListEntries.updatedAt
        })

      if (createdEntry === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create packing list entry'
        })
      }

      const entryResponse = inventoryRow === null
        ? createCustomEntryResponse(createdEntry)
        : createInventoryEntryResponse(createdEntry, inventoryRow)

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

    setResponseStatus(event, 201)

    return response
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    if (isUniqueViolation(error)) {
      throw createError({
        status: 409,
        message: 'My gear item is already in this list'
      })
    }

    throw createError({
      status: 500,
      message: 'Failed to create packing list entry'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
