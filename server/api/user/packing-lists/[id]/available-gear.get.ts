import type { InferInput } from 'valibot'
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedQuery, getValidatedRouterParams, type H3Event } from 'h3'
import { brands, equipmentCategories, equipmentItems, packingListEntries, userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'

import {
  createPackingListInventory,
  type PackingListEntryInventory,
  type PackingListInventoryRow
} from '#server/utils/packing-list-entry'

import {
  validatePackingListAvailableGearQuery,
  validatePackingListIdParams,
  type packingListAvailableGearQuerySchema
} from '#server/utils/validation/schemas'

interface AvailableGearResponse {
  items: PackingListEntryInventory[];
  nextPage: number | null;
}

const pageSize = 10

function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', String.raw`\\`)
    .replaceAll('%', String.raw`\%`)
    .replaceAll('_', String.raw`\_`)
}

export default defineEventHandler(async (event: H3Event<{ query: InferInput<typeof packingListAvailableGearQuerySchema>; }>) : Promise<AvailableGearResponse> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)
  const { page, search } = await getValidatedQuery(event, validatePackingListAvailableGearQuery)
  const { dbHttp } = event.context

  const conditions: SQL[] = [
    eq(userEquipment.userId, userId),
    isNull(packingListEntries.id)
  ]

  const itemName = sql<string>`coalesce(${userEquipment.customName}, ${equipmentItems.name})`
  const orderBy: SQL[] = []

  if (search === '') {
    orderBy.push(
      asc(itemName),
      asc(userEquipment.id)
    )
  } else {
    const escapedSearch = escapeLikePattern(search)
    const containsPattern = `%${escapedSearch}%`
    const prefixPattern = `${escapedSearch}%`

    const searchCondition = or(
      ilike(itemName, containsPattern),
      ilike(brands.name, containsPattern),
      ilike(equipmentCategories.name, containsPattern)
    )

    if (searchCondition !== undefined) {
      conditions.push(searchCondition)
    }

    const matchPriority = sql<number>`case
      when lower(${itemName}) = lower(${search}) then 0
      when ${itemName} ilike ${prefixPattern} then 1
      when ${brands.name} ilike ${prefixPattern} then 2
      when ${equipmentCategories.name} ilike ${prefixPattern} then 3
      else 4
    end`

    orderBy.push(
      matchPriority,
      asc(itemName),
      asc(userEquipment.id)
    )
  }

  const ownedListPromise = dbHttp.query.packingLists.findFirst({
    columns: {
      id: true
    },

    where: {
      id,
      userId
    }
  })

  const availableGearPromise: PromiseLike<PackingListInventoryRow[]> = dbHttp
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
    .leftJoin(
      packingListEntries,
      and(
        eq(packingListEntries.packingListId, id),
        eq(packingListEntries.userEquipmentId, userEquipment.id)
      )
    )
    .where(
      and(...conditions)
    )
    .orderBy(...orderBy)
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize)

  const [ownedList, availableGearRows] = await Promise.all([
    ownedListPromise,
    availableGearPromise
  ])

  if (ownedList === undefined) {
    throw createError({ status: 404 })
  }

  const hasNextPage = availableGearRows.length > pageSize

  const items = hasNextPage
    ? availableGearRows.slice(0, pageSize)
    : availableGearRows

  const nextPage = hasNextPage ? page + 1 : null
  const availableItems = items.map(row => createPackingListInventory(row))

  return {
    items: availableItems,
    nextPage
  }
})
