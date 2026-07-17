import { asc, eq, inArray } from 'drizzle-orm'
import {
  categoryProperties,
  itemPropertyValues,
  propertyEnumOptions
} from '#server/database/schema'
import type { createHttpClient } from '#server/utils/database'
import type {
  CatalogListBrand,
  CatalogListCategory,
  CatalogListItemRow
} from '#server/utils/equipment/catalog-list'
import {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue,
  type EquipmentPropertyDataType,
  type EquipmentPropertyValue
} from '#server/utils/equipment/property-values'

type DbHttp = ReturnType<typeof createHttpClient>

interface CatalogListProperty {
  dataType: EquipmentPropertyDataType;
  enumOptionName?: string;
  name: string;
  slug: string;
  unit: string | null;
  value: EquipmentPropertyValue;
}

interface CatalogListItem {
  brand: CatalogListBrand;
  category: CatalogListCategory;
  id: string;
  name: string;
  properties: CatalogListProperty[];
}

interface PropertyDefinitionRow {
  categoryId: number;
  dataType: string;
  displayOrder: number;
  id: number;
  name: string;
  slug: string;
  unit: string | null;
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

function groupDefinitions(rows: PropertyDefinitionRow[]) {
  const definitionsByCategoryId = new Map<number, PropertyDefinitionRow[]>()

  for (const row of rows) {
    const definitions = definitionsByCategoryId.get(row.categoryId)

    if (definitions === undefined) {
      definitionsByCategoryId.set(row.categoryId, [row])
    } else if (definitions.length < 3) {
      definitions.push(row)
    }
  }

  return definitionsByCategoryId
}

function groupValues(rows: PropertyValueRow[]) {
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

/** Loads ordered key-property definitions and shapes catalog rows without per-item queries. */
async function enrichCatalogItemRows(dbHttp: DbHttp, itemRows: CatalogListItemRow[]) : Promise<CatalogListItem[]> {
  if (itemRows.length === 0) {
    return []
  }

  const categoryIdValues = itemRows.map((item) => item.categoryId)
  const uniqueCategoryIds = new Set(categoryIdValues)
  const categoryIds = [...uniqueCategoryIds]
  const itemIds = itemRows.map((item) => item.id)
  const definitionsPromise = dbHttp
    .select({
      categoryId: categoryProperties.categoryId,
      dataType: categoryProperties.dataType,
      displayOrder: categoryProperties.displayOrder,
      id: categoryProperties.id,
      name: categoryProperties.name,
      slug: categoryProperties.slug,
      unit: categoryProperties.unit
    })
    .from(categoryProperties)
    .where(
      inArray(categoryProperties.categoryId, categoryIds)
    )
    .orderBy(
      asc(categoryProperties.categoryId),
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
    .where(
      inArray(itemPropertyValues.itemId, itemIds)
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
      inArray(categoryProperties.categoryId, categoryIds)
    )
  const [definitionRows, enumOptionRows, valueRows] = await Promise.all([
    definitionsPromise,
    enumOptionsPromise,
    valuesPromise
  ])
  const definitionsByCategoryId = groupDefinitions(definitionRows)
  const enumOptionNamesByPropertyId = groupEnumOptionNames(enumOptionRows)
  const valuesByItemId = groupValues(valueRows)

  return itemRows.map((item) => {
    const definitions = definitionsByCategoryId.get(item.categoryId) ?? []
    const itemValues = valuesByItemId.get(item.id)
    const properties = definitions.map((definition): CatalogListProperty => {
      const dataType = getEquipmentPropertyDataType(definition.dataType)
      const storedValue = itemValues?.get(definition.id)
      const value = storedValue === undefined
        ? null
        : normalizeEquipmentPropertyValue({
            dataType,
            valueBoolean: storedValue.valueBoolean,
            valueNumber: storedValue.valueNumber,
            valueText: storedValue.valueText
          })

      const property: CatalogListProperty = {
        dataType,
        name: definition.name,
        slug: definition.slug,
        unit: definition.unit,
        value
      }

      if (dataType === 'enum' && typeof value === 'string') {
        const optionNames = enumOptionNamesByPropertyId.get(definition.id)
        const enumOptionName = optionNames?.get(value)

        if (enumOptionName !== undefined) {
          property.enumOptionName = enumOptionName
        }
      }

      return property
    })

    return {
      brand: item.brand,
      category: item.category,
      id: item.id,
      name: item.name,
      properties
    }
  })
}

export {
  enrichCatalogItemRows
}

export type {
  CatalogListItem,
  CatalogListProperty
}
