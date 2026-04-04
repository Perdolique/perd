import { createError, defineEventHandler, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (id === undefined || id === '') {
    throw createError({ status: 400 })
  }

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

  interface ItemProperty {
    dataType: string
    name: string
    slug: string
    unit: string | null
    value: string | null
  }
  const properties: ItemProperty[] = []

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
