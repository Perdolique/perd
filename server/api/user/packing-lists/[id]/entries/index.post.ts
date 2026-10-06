import { and, eq, sql } from 'drizzle-orm'

import {
  createError,
  defineEventHandler,
  getValidatedRouterParams,
  isError,
  readValidatedBody,
  setResponseStatus
} from 'h3'

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
  createPackingListEntry,
  createPackingListInventory,
  type PackingListEntryInventory,
  type PackingListEntryMutationResponse,
  type PackingListInventoryRow
} from '#server/utils/packing-list-entry'

import { validatePackingListEntryCreateBody, validatePackingListIdParams } from '#server/utils/validation/schemas'

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

      let inventory: PackingListEntryInventory | null = null

      if (inventoryId !== undefined) {
        const [ownedInventoryRow]: PackingListInventoryRow[] = await transaction
          .select({
            brand: brands.name,
            category: equipmentCategories.name,
            customName: userEquipment.customName,
            inventoryId: userEquipment.id,
            itemName: equipmentItems.name
          })
          .from(userEquipment)
          .leftJoin(equipmentItems, eq(userEquipment.itemId, equipmentItems.id))
          .leftJoin(brands, eq(equipmentItems.brandId, brands.id))
          .leftJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
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

        inventory = createPackingListInventory(ownedInventoryRow)
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

      const entryResponse = createPackingListEntry(createdEntry, inventory)

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
    const isExpectedClientError = isError(error) && error.statusCode < 500

    if (isExpectedClientError) {
      throw error
    }

    let current = error

    for (let depth = 0; depth < 4 && current !== null && typeof current === 'object'; depth += 1) {
      const code: unknown = Reflect.get(current, 'code')

      if (code === '23505') {
        throw createError({
          status: 409,
          message: 'My gear item is already in this list'
        })
      }

      if (code === '23503') {
        throw createError({ status: 404 })
      }

      current = Reflect.get(current, 'cause')
    }

    console.error('Failed to create packing list entry', error)

    throw createError({
      status: 500,
      message: 'Failed to create packing list entry'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
