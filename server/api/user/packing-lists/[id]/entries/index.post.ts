import type { InferInput } from 'valibot'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, readValidatedBody, setResponseStatus } from 'nuxt/server'
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
  validatePackingListEntryCreateBody,
  validatePackingListIdParams,
  type packingListEntryCreateBodySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof packingListEntryCreateBodySchema>; }>) : Promise<PackingListEntryMutationResponse> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validatePackingListIdParams)
  const { customName, inventoryId } = await readValidatedBody(event, validatePackingListEntryCreateBody)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    const response = await dbWebsocket.transaction(async (transaction) => {
      const ownedList = await lockPackingList(transaction, id, userId)
      const updatedAt = nextPackingListUpdatedAt(ownedList.updatedAt)
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
          createdAt: updatedAt,
          updatedAt,
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

    setResponseStatus(event, 201)

    return response
  } catch (error) {
    const isExpectedClientError = isNuxtError(error) && error.status < 500

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
    await closePackingListWriteClient(dbWebsocket)
  }
})
