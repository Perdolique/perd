import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { getPrimaryEquipmentImageIds } from '#server/utils/equipment/primary-images'

import {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue,
  type EquipmentPropertyDataType,
  type EquipmentPropertyValue
} from '#server/utils/equipment/property-values'

import { validateItemDetailParams } from '#server/utils/validation/schemas'
import { validateSessionUser } from '#server/utils/session'

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
  enumOptionName?: string;
  name: string;
  slug: string;
  unit: string | null;
  value: EquipmentPropertyValue;
}

interface ItemDetailResponse {
  brand: ItemDetailBrand;
  category: ItemDetailCategory;
  cloudflareImageId: string | null;
  createdAt: Date | string;
  id: string;
  isInMyGear: boolean;
  name: string;
  properties: ItemProperty[];
}

export default defineEventHandler(async (event) : Promise<ItemDetailResponse> => {
  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)
  const userId = await validateSessionUser(event)

  const itemPromise = event.context.dbHttp.query.equipmentItems.findFirst({
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
      userEquipment: {
        columns: {
          id: true
        },

        where: {
          userId
        },

        limit: 1
      },

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
            },

            with: {
              enumOptions: {
                columns: {
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      }
    }
  })

  const imageIdsPromise = getPrimaryEquipmentImageIds({
    dbHttp: event.context.dbHttp,
    itemIds: [id]
  })

  const [imageIdsByItemId, item] = await Promise.all([imageIdsPromise, itemPromise])

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

      const itemProperty: ItemProperty = {
        dataType,
        name: property.name,
        slug: property.slug,
        unit: property.unit,
        value
      }

      if (dataType === 'enum' && typeof value === 'string') {
        const enumOption = property.enumOptions.find((option: { name: string; slug: string; }) => option.slug === value)

        if (enumOption !== undefined) {
          itemProperty.enumOptionName = enumOption.name
        }
      }

      properties.push(itemProperty)
    }
  }

  const cloudflareImageId = imageIdsByItemId.get(item.id) ?? null

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

    cloudflareImageId,
    createdAt: item.createdAt,
    id: item.id,
    isInMyGear: item.userEquipment.length > 0,
    name: item.name,
    properties
  }
})

export type { ItemDetailResponse }
