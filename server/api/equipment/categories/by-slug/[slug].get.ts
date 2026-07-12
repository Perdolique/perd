import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateCategoryDetailParams } from '#server/utils/validation/schemas'

interface CategoryDetailEnumOption {
  id: number;
  name: string;
  slug: string;
}

interface CategoryDetailProperty {
  dataType: string;
  enumOptions?: CategoryDetailEnumOption[];
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface CategoryDetailResponse {
  id: number;
  name: string;
  properties: CategoryDetailProperty[];
  slug: string;
}

export default defineEventHandler(async (event) : Promise<CategoryDetailResponse> => {
  const { slug } = await getValidatedRouterParams(event, validateCategoryDetailParams)

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

export type { CategoryDetailResponse }
