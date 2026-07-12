import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue,
  type EquipmentPropertyDataType,
  type EquipmentPropertyValue
} from '#server/utils/equipment/property-values'
import { validateItemDetailParams } from '#server/utils/validation/schemas'

interface ItemDetailBrand {
  id: number;
  name: string;
  slug: string;
}

interface ItemDetailCategory {
  id: number;
  name: string;
  slug: string;
}

interface ItemProperty {
  dataType: EquipmentPropertyDataType;
  name: string;
  slug: string;
  unit: string | null;
  value: EquipmentPropertyValue;
}

interface ItemDetailResponse {
  brand: ItemDetailBrand;
  category: ItemDetailCategory;
  createdAt: Date | string;
  id: string;
  name: string;
  properties: ItemProperty[];
}

export default defineEventHandler(async (event) : Promise<ItemDetailResponse> => {
  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)

  const item = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      createdAt: true,
      id: true,
      name: true
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
          slug: true
        }
      },

      propertyValues: {
        columns: {
          valueBoolean: true,
          valueNumber: true,
          valueText: true
        },

        with: {
          property: {
            columns: {
              dataType: true,
              displayOrder: true,
              id: true,
              name: true,
              slug: true,
              unit: true
            }
          }
        }
      }
    }
  })

  if (item === undefined) {
    throw createError({ status: 404 })
  }

  if (item.brand === null || item.category === null) {
    throw createError({
      status: 500,
      message: 'Failed to load item reference data'
    })
  }

  const properties: ItemProperty[] = []
  const propertyValues = [...item.propertyValues]

  propertyValues.sort((left, right) => {
    const leftProperty = left.property
    const rightProperty = right.property

    if (leftProperty === null && rightProperty === null) {
      return 0
    }

    if (leftProperty === null) {
      return 1
    }

    if (rightProperty === null) {
      return -1
    }

    const displayOrderDifference = leftProperty.displayOrder - rightProperty.displayOrder

    if (displayOrderDifference !== 0) {
      return displayOrderDifference
    }

    return leftProperty.id - rightProperty.id
  })

  for (const propertyValue of propertyValues) {
    const { property } = propertyValue

    if (property !== null) {
      const dataType = getEquipmentPropertyDataType(property.dataType)
      const value = normalizeEquipmentPropertyValue({
        dataType,
        valueBoolean: propertyValue.valueBoolean,
        valueNumber: propertyValue.valueNumber,
        valueText: propertyValue.valueText
      })

      properties.push({
        dataType,
        name: property.name,
        slug: property.slug,
        unit: property.unit,
        value
      })
    }
  }

  return {
    brand: {
      id: item.brand.id,
      name: item.brand.name,
      slug: item.brand.slug
    },

    category: {
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug
    },

    createdAt: item.createdAt,
    id: item.id,
    name: item.name,
    properties
  }
})
