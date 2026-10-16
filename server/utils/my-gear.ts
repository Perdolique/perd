import { and, desc, eq } from 'drizzle-orm'
import { createError } from 'nuxt/server'

import {
  brands,
  categoryProperties,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues,
  userEquipment
} from '#server/database/schema'

import type { createHttpClient } from '#server/utils/database'
import { compareDecimalNumbers, isFiniteDecimalNumber, normalizeDecimalNumber } from '#shared/utils/decimal-number'

interface MyGearEntity {
  name: string;
  slug: string;
}

interface MyGearItem {
  brand: MyGearEntity;
  category: MyGearEntity;
  id: string;
  name: string;
  weightGrams: string | null;
}

interface MyGearRecordBase {
  createdAt: Date | string;
  id: string;
  measuredWeightGrams: string | null;
  note: string | null;
  ownedQuantity: number;
}

interface CatalogMyGearRecord extends MyGearRecordBase {
  source: 'catalog';
  personalName: string | null;
  item: MyGearItem;
}

interface CustomMyGearRecord extends MyGearRecordBase {
  source: 'custom';
  customName: string;
}

type MyGearRecord = CatalogMyGearRecord | CustomMyGearRecord
type MyGearReadDatabase = ReturnType<typeof createHttpClient>

/** Reads complete private gear records, including live catalog weight, for all gear endpoints. */
async function readMyGear(database: MyGearReadDatabase, userId: string, id?: string): Promise<MyGearRecord[]> {
  const conditions = [eq(userEquipment.userId, userId)]

  if (id !== undefined) {
    conditions.push(eq(userEquipment.id, id))
  }

  const rows = await database
    .select({
      id: userEquipment.id,
      createdAt: userEquipment.createdAt,
      customName: userEquipment.customName,
      personalName: userEquipment.personalName,
      measuredWeightGrams: userEquipment.measuredWeightGrams,
      note: userEquipment.note,
      ownedQuantity: userEquipment.ownedQuantity,
      itemId: equipmentItems.id,
      itemName: equipmentItems.name,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryName: equipmentCategories.name,
      categorySlug: equipmentCategories.slug,
      catalogWeightGrams: itemPropertyValues.valueNumber
    })
    .from(userEquipment)
    .leftJoin(equipmentItems, eq(userEquipment.itemId, equipmentItems.id))
    .leftJoin(brands, eq(equipmentItems.brandId, brands.id))
    .leftJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
    .leftJoin(categoryProperties, and(
      eq(categoryProperties.categoryId, equipmentItems.categoryId),
      eq(categoryProperties.slug, 'weight'),
      eq(categoryProperties.dataType, 'number'),
      eq(categoryProperties.unit, 'g')
    ))
    .leftJoin(itemPropertyValues, and(
      eq(itemPropertyValues.itemId, equipmentItems.id),
      eq(itemPropertyValues.propertyId, categoryProperties.id)
    ))
    .where(
      and(...conditions)
    )
    .orderBy(desc(userEquipment.createdAt), desc(userEquipment.id))

  const records = rows.map((row): MyGearRecord => {
    const measuredWeightGrams = row.measuredWeightGrams === null ? null : normalizeDecimalNumber(row.measuredWeightGrams)

    if (row.customName !== null) {
      return {
        id: row.id,
        createdAt: row.createdAt,
        measuredWeightGrams,
        note: row.note,
        ownedQuantity: row.ownedQuantity,
        customName: row.customName,
        source: 'custom'
      }
    }

    const { itemId, itemName, brandName, brandSlug, categoryName, categorySlug } = row
    const isCatalogIncomplete = itemId === null || itemName === null || brandName === null || brandSlug === null || categoryName === null || categorySlug === null

    if (isCatalogIncomplete) {
      throw createError({
        status: 500,
        message: 'Could not load saved gear'
      })
    }

    const rawWeight = row.catalogWeightGrams
    const hasWeight = rawWeight !== null && isFiniteDecimalNumber(rawWeight) && compareDecimalNumbers(rawWeight, '0') >= 0
    const weightGrams = hasWeight ? normalizeDecimalNumber(rawWeight) : null

    return {
      id: row.id,
      createdAt: row.createdAt,
      measuredWeightGrams,
      note: row.note,
      ownedQuantity: row.ownedQuantity,
      source: 'catalog',
      personalName: row.personalName,

      item: {
        id: itemId,
        name: itemName,
        weightGrams,

        brand: {
          name: brandName,
          slug: brandSlug
        },

        category: {
          name: categoryName,
          slug: categorySlug
        }
      }
    }
  })

  return records
}

export { readMyGear }
export type { MyGearRecord }
