import type { InferInput } from 'valibot'
import { and, eq, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody, type H3Event } from 'h3'

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

import {
  validatePackingListEntryParams,
  validatePackingListEntryUpdateBody,
  type packingListEntryUpdateBodySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof packingListEntryUpdateBodySchema>; }>) : Promise<PackingListEntryMutationResponse> => {
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

      let inventory: PackingListEntryInventory | null = null

      if (updatedEntry.userEquipmentId !== null) {
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
              eq(userEquipment.id, updatedEntry.userEquipmentId),
              eq(userEquipment.userId, userId)
            )
          )
          .limit(1)

        if (ownedInventoryRow === undefined) {
          throw createError({ status: 404 })
        }

        inventory = createPackingListInventory(ownedInventoryRow)
      }

      const entryResponse = createPackingListEntry(updatedEntry, inventory)

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
    const isExpectedClientError = isError(error) && error.statusCode < 500

    if (isExpectedClientError) {
      throw error
    }

    console.error('Failed to update packing list entry', error)

    throw createError({
      status: 500,
      message: 'Failed to update packing list entry'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
