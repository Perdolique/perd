import { createError, defineEventHandler, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (slug === undefined || slug === '') {
    throw createError({ status: 400 })
  }

  const brand = await event.context.dbHttp.query.brands.findFirst({
    columns: {
      id: true,
      name: true,
      slug: true
    },

    where: {
      slug
    },

    with: {
      items: {
        columns: {
          id: true,
          name: true
        },

        where: {
          status: 'approved'
        },

        with: {
          category: {
            columns: {
              name: true,
              slug: true
            }
          }
        }
      }
    }
  })

  if (brand === undefined) {
    throw createError({ status: 404 })
  }

  return brand
})
