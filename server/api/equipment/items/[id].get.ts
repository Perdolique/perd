import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
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
  dataType: string;
  name: string;
  slug: string;
  unit: string | null;
  value: string | null;
}

interface ItemDetailResponse {
  brand: ItemDetailBrand;
  category: ItemDetailCategory;
  createdAt: Date | string;
  id: string;
  name: string;
  properties: ItemProperty[];
  status: string;
}

export default defineEventHandler(async (event) : Promise<ItemDetailResponse> => {
  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)

  const item = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      status: true
    },

    where: {
      id
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

  // Property values live in type-specific columns, so the response normalizes them into one `value` field.
  for (const propertyValue of item.propertyValues) {
    const { property } = propertyValue

    if (property !== null) {
      let value: string | null = propertyValue.valueText

      if (property.dataType === 'number') {
        value = propertyValue.valueNumber
      } else if (property.dataType === 'boolean') {
        value = String(propertyValue.valueBoolean)
      }

      properties.push({
        dataType: property.dataType,
        name: property.name,
        slug: property.slug,
        unit: property.unit,
        value
      })
    }
  }

  return {
    brand: item.brand,
    category: item.category,
    createdAt: item.createdAt,
    id: item.id,
    name: item.name,
    properties,
    status: item.status
  }
})
