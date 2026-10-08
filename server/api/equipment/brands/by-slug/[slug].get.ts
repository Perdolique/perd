import { createError, defineEventHandler } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { validateBrandDetailParams } from '#server/utils/validation/schemas'

interface BrandDetailResponse {
  id: number;
  name: string;
  slug: string;
}

export default defineEventHandler(async (event) : Promise<BrandDetailResponse> => {
  const { slug } = await getValidatedRouteParams(event, validateBrandDetailParams)

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
