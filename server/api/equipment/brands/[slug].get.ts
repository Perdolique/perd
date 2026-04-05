import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateBrandDetailParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { slug } = await getValidatedRouterParams(event, validateBrandDetailParams)

  const brand = await event.context.dbHttp.query.brands.findFirst({
    columns: {
      id: true,
      name: true,
      slug: true
    },

    where: {
      slug
    }
  })

  if (brand === undefined) {
    throw createError({ status: 404 })
  }

  return brand
})
