import { and, count, eq, sql } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { brands, equipmentCategories, equipmentItems, userEquipment } from '#server/database/schema'

import {
  buildCatalogListSql,
  catalogPropertySortValues,
  type CatalogListItemRow
} from '#server/utils/equipment/catalog-list'

import { enrichCatalogItemRows, type CatalogListItem } from '#server/utils/equipment/catalog-list-enrichment'
import { validateSessionUser } from '#server/utils/session'
import { validateItemsListQuery } from '#server/utils/validation/schemas'

interface ReturnData {
  items: CatalogListItem[];
  limit: number;
  page: number;
  total: number;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const { dbHttp } = event.context
  const validatedQuery = await getValidatedQuery(event, validateItemsListQuery)
  const userId = await validateSessionUser(event)
  const { limit, page } = validatedQuery
  const { orderBy, sortPropertyId, where } = await buildCatalogListSql(dbHttp, validatedQuery)

  const selection = {
    categoryId: equipmentItems.categoryId,
    id: equipmentItems.id,

    isInMyGear: sql<boolean>`exists (
      select 1
      from ${userEquipment}
      where ${userEquipment.userId} = ${userId}
        and ${userEquipment.itemId} = ${equipmentItems.id}
    )`,

    name: equipmentItems.name,

    brand: {
      name: brands.name,
      slug: brands.slug
    },

    category: {
      name: equipmentCategories.name,
      slug: equipmentCategories.slug
    }
  }

  const baseItemsQuery = dbHttp
    .select(selection)
    .from(equipmentItems)
    .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
    .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))

  const itemsPromise = sortPropertyId === undefined
    ? baseItemsQuery
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit)
    : baseItemsQuery
        .leftJoin(
          catalogPropertySortValues,
          and(
            eq(catalogPropertySortValues.itemId, equipmentItems.id),
            eq(catalogPropertySortValues.propertyId, sortPropertyId)
          )
        )
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit)

  const countPromise = dbHttp
    .select({ total: count() })
    .from(equipmentItems)
    .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
    .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
    .where(where)

  const [itemResults, countRows] = await Promise.all([itemsPromise, countPromise])
  const itemRows = itemResults as CatalogListItemRow[]
  const items = await enrichCatalogItemRows(dbHttp, itemRows)
  const total = countRows[0]?.total ?? 0

  return { items, limit, page, total }
})
