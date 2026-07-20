import { and, asc, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedQuery } from 'h3'

import {
  brands,
  categoryProperties,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues,
  propertyEnumOptions
} from '#server/database/schema'

import {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue,
  type EquipmentPropertyDataType,
  type EquipmentPropertyValue
} from '#server/utils/equipment/property-values'

import { validateEquipmentComparisonQuery } from '#server/utils/validation/schemas'

interface ComparisonCategory {
  id: number;
  name: string;
  slug: string;
}

interface ComparisonItemBrand {
  name: string;
  slug: string;
}

interface ComparisonItemSummary {
  brand: ComparisonItemBrand;
  id: string;
  name: string;
}

interface ComparisonPropertyValue {
  enumOptionName?: string;
  itemId: string;
  value: EquipmentPropertyValue;
}

interface ComparisonProperty {
  dataType: EquipmentPropertyDataType;
  id: number;
  name: string;
  slug: string;
  unit: string | null;
  values: ComparisonPropertyValue[];
}

interface ComparisonResponse {
  category: ComparisonCategory;
  items: ComparisonItemSummary[];
  properties: ComparisonProperty[];
}

interface PropertyValueRow {
  itemId: string;
  propertyId: number;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

interface PropertyEnumOptionRow {
  name: string;
  propertyId: number;
  slug: string;
}

/** Indexes stored EAV values by item and property ID. */
function groupPropertyValues(rows: PropertyValueRow[]) {
  const valuesByItemId = new Map<string, Map<number, PropertyValueRow>>()

  for (const row of rows) {
    const itemValues = valuesByItemId.get(row.itemId)

    if (itemValues === undefined) {
      valuesByItemId.set(row.itemId, new Map([[row.propertyId, row]]))
    } else {
      itemValues.set(row.propertyId, row)
    }
  }

  return valuesByItemId
}

/** Indexes current enum option names by property ID and canonical slug. */
function groupEnumOptionNames(rows: PropertyEnumOptionRow[]) {
  const optionNamesByPropertyId = new Map<number, Map<string, string>>()

  for (const row of rows) {
    const optionNames = optionNamesByPropertyId.get(row.propertyId)

    if (optionNames === undefined) {
      optionNamesByPropertyId.set(row.propertyId, new Map([[row.slug, row.name]]))
    } else {
      optionNames.set(row.slug, row.name)
    }
  }

  return optionNamesByPropertyId
}

export default defineEventHandler(async (event) : Promise<ComparisonResponse> => {
  const { itemId: itemIds } = await getValidatedQuery(event, validateEquipmentComparisonQuery)
  const { dbHttp } = event.context

  const itemRows = await dbHttp
    .select({
      id: equipmentItems.id,
      name: equipmentItems.name,

      brand: {
        name: brands.name,
        slug: brands.slug
      },

      category: {
        id: equipmentCategories.id,
        name: equipmentCategories.name,
        slug: equipmentCategories.slug
      }
    })
    .from(equipmentItems)
    .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
    .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
    .where(
      and(
        eq(equipmentItems.status, 'approved'),
        inArray(equipmentItems.id, itemIds)
      )
    )

  if (itemRows.length !== itemIds.length) {
    throw createError({ status: 404 })
  }

  const itemRowsById = new Map<string, (typeof itemRows)[number]>()

  for (const itemRow of itemRows) {
    itemRowsById.set(itemRow.id, itemRow)
  }

  const orderedItemRows: typeof itemRows = []

  for (const itemId of itemIds) {
    const itemRow = itemRowsById.get(itemId)

    if (itemRow === undefined) {
      throw createError({ status: 404 })
    }

    orderedItemRows.push(itemRow)
  }

  const [firstItem] = orderedItemRows

  if (firstItem === undefined) {
    throw createError({ status: 404 })
  }

  const categoryId = firstItem.category.id
  let hasMixedCategories = false

  for (const itemRow of orderedItemRows) {
    if (itemRow.category.id !== categoryId) {
      hasMixedCategories = true
      break
    }
  }

  if (hasMixedCategories) {
    throw createError({
      status: 400,
      message: 'Items must belong to the same category'
    })
  }

  const definitionsPromise = dbHttp
    .select({
      dataType: categoryProperties.dataType,
      displayOrder: categoryProperties.displayOrder,
      id: categoryProperties.id,
      name: categoryProperties.name,
      slug: categoryProperties.slug,
      unit: categoryProperties.unit
    })
    .from(categoryProperties)
    .where(
      eq(categoryProperties.categoryId, categoryId)
    )
    .orderBy(
      asc(categoryProperties.displayOrder),
      asc(categoryProperties.id)
    )

  const valuesPromise = dbHttp
    .select({
      itemId: itemPropertyValues.itemId,
      propertyId: itemPropertyValues.propertyId,
      valueBoolean: itemPropertyValues.valueBoolean,
      valueNumber: itemPropertyValues.valueNumber,
      valueText: itemPropertyValues.valueText
    })
    .from(itemPropertyValues)
    .innerJoin(categoryProperties, eq(itemPropertyValues.propertyId, categoryProperties.id))
    .where(
      and(
        eq(categoryProperties.categoryId, categoryId),
        inArray(itemPropertyValues.itemId, itemIds)
      )
    )

  const enumOptionsPromise = dbHttp
    .select({
      name: propertyEnumOptions.name,
      propertyId: propertyEnumOptions.propertyId,
      slug: propertyEnumOptions.slug
    })
    .from(propertyEnumOptions)
    .innerJoin(categoryProperties, eq(propertyEnumOptions.propertyId, categoryProperties.id))
    .where(
      eq(categoryProperties.categoryId, categoryId)
    )

  const [definitionRows, enumOptionRows, valueRows] = await Promise.all([
    definitionsPromise,
    enumOptionsPromise,
    valuesPromise
  ])

  const valuesByItemId = groupPropertyValues(valueRows)
  const enumOptionNamesByPropertyId = groupEnumOptionNames(enumOptionRows)
  const items: ComparisonItemSummary[] = []

  for (const itemRow of orderedItemRows) {
    items.push({
      brand: {
        name: itemRow.brand.name,
        slug: itemRow.brand.slug
      },
      id: itemRow.id,
      name: itemRow.name
    })
  }

  const properties: ComparisonProperty[] = []

  for (const definition of definitionRows) {
    const dataType = getEquipmentPropertyDataType(definition.dataType)
    const values: ComparisonPropertyValue[] = []

    for (const itemRow of orderedItemRows) {
      const itemValues = valuesByItemId.get(itemRow.id)
      const storedValue = itemValues?.get(definition.id)
      const value = storedValue === undefined
        ? null
        : normalizeEquipmentPropertyValue({
            dataType,
            valueBoolean: storedValue.valueBoolean,
            valueNumber: storedValue.valueNumber,
            valueText: storedValue.valueText
          })

      const comparisonValue: ComparisonPropertyValue = {
        itemId: itemRow.id,
        value
      }

      if (dataType === 'enum' && typeof value === 'string') {
        const optionNames = enumOptionNamesByPropertyId.get(definition.id)
        const enumOptionName = optionNames?.get(value)

        if (enumOptionName !== undefined) {
          comparisonValue.enumOptionName = enumOptionName
        }
      }

      values.push(comparisonValue)
    }

    properties.push({
      dataType,
      id: definition.id,
      name: definition.name,
      slug: definition.slug,
      unit: definition.unit,
      values
    })
  }

  return {
    category: {
      id: firstItem.category.id,
      name: firstItem.category.name,
      slug: firstItem.category.slug
    },
    items,
    properties
  }
})
