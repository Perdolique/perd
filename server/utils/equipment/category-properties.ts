import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { createError } from 'h3'

import {
  categoryProperties,
  equipmentCategories,
  itemPropertyValues,
  propertyEnumOptions
} from '#server/database/schema'

import type { createWebSocketClient } from '#server/utils/database'
import { getEquipmentPropertyDataType, type EquipmentPropertyDataType } from '#server/utils/equipment/property-values'

type PropertiesDatabase = ReturnType<typeof createWebSocketClient>
type PropertiesTransaction = Parameters<Parameters<PropertiesDatabase['transaction']>[0]>[0]

interface AdminPropertyOption {
  id: number;
  name: string;
  slug: string;
  usedItemCount: number;
}

interface AdminCategoryProperty {
  allowsNegativeValues: boolean;
  dataType: EquipmentPropertyDataType;
  displayOrder: number;
  enumOptions: AdminPropertyOption[];
  id: number;
  name: string;
  negativeValueCount: number;
  slug: string;
  unit: string | null;
  usedItemCount: number;
}

interface PropertiesCategory {
  id: number;
  name: string;
  propertiesRevision: number;
  slug: string;
}

interface AdminCategoryPropertiesSnapshot {
  category: PropertiesCategory;
  properties: AdminCategoryProperty[];
}

function propertiesConflict(code: string, message: string) {
  return createError({
    status: 409,
    message,
    data: { code }
  })
}

function checkPropertiesRevision(actual: number, expected: number | undefined): void {
  if (actual !== expected) {
    throw propertiesConflict('properties_revision_conflict', 'Characteristics changed since this form was loaded. Reload before continuing.')
  }
}

/** Categories own the lock and revision for definitions, options, and item-value writes. */
async function lockPropertiesCategories(transaction: PropertiesTransaction, categoryIds: number[]) {
  const categories = await transaction
    .select({
      id: equipmentCategories.id,
      propertiesRevision: equipmentCategories.propertiesRevision
    })
    .from(equipmentCategories)
    .where(
      inArray(equipmentCategories.id, categoryIds)
    )
    .orderBy(asc(equipmentCategories.id))
    .for('share')

  const uniqueIds = new Set(categoryIds)

  if (categories.length !== uniqueIds.size) {
    throw createError({ status: 404 })
  }

  return categories
}

/** The caller owns the transaction so definitions and usage come from one snapshot. */
async function readCategoryPropertiesSnapshot(
  transaction: PropertiesTransaction,
  categoryId: number
): Promise<AdminCategoryPropertiesSnapshot> {
  const category = await transaction.query.equipmentCategories.findFirst({
    columns: {
      id: true,
      name: true,
      propertiesRevision: true,
      slug: true
    },

    where: {
      id: categoryId
    },

    with: {
      properties: {
        orderBy: {
          displayOrder: 'asc',
          id: 'asc'
        },

        with: {
          enumOptions: {
            orderBy: {
              id: 'asc'
            }
          }
        }
      }
    }
  })

  if (category === undefined) {
    throw createError({ status: 404 })
  }

  const usage = await transaction
    .select({
      propertyId: itemPropertyValues.propertyId,
      usedItemCount: count(),
      negativeValueCount: sql<number>`count(*) filter (where ${itemPropertyValues.valueNumber} < 0)::integer`
    })
    .from(itemPropertyValues)
    .innerJoin(categoryProperties, eq(itemPropertyValues.propertyId, categoryProperties.id))
    .where(
      eq(categoryProperties.categoryId, categoryId)
    )
    .groupBy(itemPropertyValues.propertyId)

  const optionUsage = await transaction
    .select({
      optionId: propertyEnumOptions.id,
      usedItemCount: count(itemPropertyValues.id)
    })
    .from(propertyEnumOptions)
    .innerJoin(categoryProperties, eq(propertyEnumOptions.propertyId, categoryProperties.id))
    .leftJoin(itemPropertyValues, and(
      eq(itemPropertyValues.propertyId, propertyEnumOptions.propertyId),
      eq(itemPropertyValues.valueText, propertyEnumOptions.slug)
    ))
    .where(
      eq(categoryProperties.categoryId, categoryId)
    )
    .groupBy(propertyEnumOptions.id)

  const propertyUsageEntries = usage.map((entry) => [entry.propertyId, entry] as const)
  const optionUsageEntries = optionUsage.map((entry) => [entry.optionId, entry.usedItemCount] as const)
  const usageByProperty = new Map(propertyUsageEntries)
  const usageByOption = new Map(optionUsageEntries)

  const properties = category.properties.map((property) => {
    const stats = usageByProperty.get(property.id)

    const enumOptions = property.enumOptions.map((option) => {
      return {
        id: option.id,
        name: option.name,
        slug: option.slug,
        usedItemCount: usageByOption.get(option.id) ?? 0
      }
    })

    const dataType = getEquipmentPropertyDataType(property.dataType)

    return {
      allowsNegativeValues: property.allowsNegativeValues,
      dataType,
      displayOrder: property.displayOrder,
      enumOptions,
      id: property.id,
      name: property.name,
      negativeValueCount: stats?.negativeValueCount ?? 0,
      slug: property.slug,
      unit: property.unit,
      usedItemCount: stats?.usedItemCount ?? 0
    }
  })

  return {
    category: {
      id: category.id,
      name: category.name,
      propertiesRevision: category.propertiesRevision,
      slug: category.slug
    },

    properties
  }
}

export { checkPropertiesRevision, lockPropertiesCategories, propertiesConflict, readCategoryPropertiesSnapshot }
export type { AdminCategoryPropertiesSnapshot, AdminCategoryProperty, AdminPropertyOption, PropertiesTransaction }
