import type { InferInput } from 'valibot'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'

import {
  brands,
  equipmentCategories,
  equipmentItems,
  packingListEntries,
  packingLists,
  userEquipment
} from '#server/database/schema'

import { createRuntimeWebSocketClient } from '#server/utils/config'

import {
  closePackingListWriteClient,
  lockPackingList,
  nextPackingListUpdatedAt
} from '#server/utils/packing-list-write'

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

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof packingListEntryUpdateBodySchema>; }>) : Promise<PackingListEntryMutationResponse> => {
  const userId = await validateSessionUser(event)
  const { entryId, id } = await getValidatedRouteParams(event, validatePackingListEntryParams)
  const { isPacked } = await readValidatedBody(event, validatePackingListEntryUpdateBody)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const ownedList = await lockPackingList(transaction, id, userId)
      const updatedAt = nextPackingListUpdatedAt(ownedList.updatedAt)

      const [updatedEntry] = await transaction
        .update(packingListEntries)
        .set({
          isPacked,
          updatedAt
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
          updatedAt
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
    }, { isolationLevel: 'read committed' })
  } catch (error) {
    const isExpectedClientError = isNuxtError(error) && error.status < 500

    if (isExpectedClientError) {
      throw error
    }

    console.error('Failed to update packing list entry', error)

    throw createError({
      status: 500,
      message: 'Failed to update packing list entry'
    })
  } finally {
    await closePackingListWriteClient(dbWebsocket)
  }
})
