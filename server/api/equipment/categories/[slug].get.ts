import { createError, defineEventHandler, getRouterParams } from 'h3'
import { validateCategoryDetailParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const params = getRouterParams(event)
  const { slug } = validateCategoryDetailParams({
    slug: params.slug ?? params.id
  })

  const category = await event.context.dbHttp.query.equipmentCategories.findFirst({
    columns: {
      id: true,
      name: true,
      slug: true
    },

    where: {
      slug
    },

    with: {
      properties: {
        columns: {
          dataType: true,
          id: true,
          name: true,
          slug: true,
          unit: true
        },

        with: {
          enumOptions: {
            columns: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }
    }
  })

  if (category === undefined) {
    throw createError({ status: 404 })
  }

  type Property = (typeof category.properties)[number]

  const properties = category.properties.map((property: Property) => {
    if (property.dataType === 'enum') {
      return property
    }

    return {
      dataType: property.dataType,
      id: property.id,
      name: property.name,
      slug: property.slug,
      unit: property.unit
    }
  })

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    properties
  }
})
