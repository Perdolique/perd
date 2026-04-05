import { ilike, type SQL } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { brands } from '#server/database/schema'
import { validateBrandsListQuery } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const { search } = await getValidatedQuery(event, validateBrandsListQuery)

  const safeSearch = search
    .trim()
    .replaceAll('%', String.raw`\%`)
    .replaceAll('_', String.raw`\_`)

  const whereCondition: SQL | undefined = safeSearch === '' ? undefined : ilike(brands.name, `%${safeSearch}%`)

  const brandsQuery = dbHttp
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug
    })
    .from(brands)

  const filteredBrandsQuery = whereCondition === undefined
    ? brandsQuery
    : brandsQuery.where(whereCondition)

  return filteredBrandsQuery
})
