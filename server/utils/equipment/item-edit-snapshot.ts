import { createError } from 'h3'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import type { PropertiesTransaction } from '#server/utils/equipment/category-properties'
import type { EquipmentItemPropertyInput } from '#server/utils/equipment/item-properties'
import { getEquipmentPropertyDataType } from '#server/utils/equipment/property-values'

interface EquipmentItemEditBrand {
  id: number;
  name: string;
  slug: string;
}

interface EquipmentItemEditResponse {
  id: string;
  name: string;
  brand: EquipmentItemEditBrand;
  category: CategoryDetailResponse;
  properties: EquipmentItemPropertyInput[];
  revision: number;
}

/** Reads editable values and their definitions together, without number rounding. */
async function readEquipmentItemEditSnapshot(database: Pick<PropertiesTransaction, 'query'>, id: string): Promise<EquipmentItemEditResponse> {
  const item = await database.query.equipmentItems.findFirst({
    columns: {
      id: true,
      name: true,
      revision: true
    },

    where: {
      id,
      status: 'approved'
    },

    with: {
      brand: {
        columns: {
          id: true,
          name: true,
          slug: true
        }
      },

      category: {
        columns: {
          id: true,
          name: true,
          slug: true,
          propertiesRevision: true
        },

        with: {
          properties: {
            columns: {
              id: true,
              name: true,
              slug: true,
              dataType: true,
              unit: true,
              allowsNegativeValues: true
            },

            orderBy: {
              displayOrder: 'asc',
              id: 'asc'
            },

            with: {
              enumOptions: {
                columns: {
                  id: true,
                  name: true,
                  slug: true
                },

                orderBy: {
                  id: 'asc'
                }
              }
            }
          }
        }
      },

      propertyValues: {
        columns: {
          propertyId: true,
          valueBoolean: true,
          valueNumber: true,
          valueText: true
        },

        orderBy: {
          propertyId: 'asc'
        }
      }
    }
  })

  if (item === undefined) { throw createError({ status: 404 }) }

  if (item.brand === null || item.category === null) { throw new Error(`Item ${id} has missing reference data`) }

  const properties = item.propertyValues.map((property) => {
    const value = property.valueBoolean ?? property.valueNumber ?? property.valueText

    if (value === null) { throw new Error(`Item ${id} property ${property.propertyId} has no value`) }

    return {
      propertyId: property.propertyId,
      value
    }
  })

  const definitions = item.category.properties.map((property) => {
    const dataType = getEquipmentPropertyDataType(property.dataType)

    return {
      id: property.id,
      name: property.name,
      slug: property.slug,
      dataType,
      unit: property.unit,
      allowsNegativeValues: property.allowsNegativeValues,
      enumOptions: property.enumOptions
    }
  })

  return {
    id: item.id,
    name: item.name,
    brand: item.brand,

    category: {
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
      propertiesRevision: item.category.propertiesRevision,
      properties: definitions
    },

    properties,
    revision: item.revision
  }
}

/** Retains the meaning of old values even after a reference is renamed or deleted. */
function equipmentItemAuditSnapshot(item: EquipmentItemEditResponse) {
  const definitionEntries = item.category.properties.map((property) => [property.id, property] as const)
  const definitions = new Map(definitionEntries)

  const properties = item.properties.map((property) => {
    const definition = definitions.get(property.propertyId)

    if (definition === undefined) { throw new Error(`Item ${item.id} has a property outside its category`) }

    const enumOptionName = definition.enumOptions?.find((option) => option.slug === property.value)?.name ?? null

    return {
      propertyId: property.propertyId,
      name: definition.name,
      slug: definition.slug,
      dataType: definition.dataType,
      unit: definition.unit,
      enumOptionName,
      value: property.value
    }
  })

  return {
    name: item.name,
    brand: item.brand,

    category: {
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug
    },

    properties,
    revision: item.revision
  }
}

export { readEquipmentItemEditSnapshot, equipmentItemAuditSnapshot }
export type { EquipmentItemEditResponse }
