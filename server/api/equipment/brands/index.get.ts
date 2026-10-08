import { ilike, type SQL } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import type { InferInput } from 'valibot'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { brands } from '#server/database/schema'
import { validateBrandsListQuery, type brandsListQuerySchema } from '#server/utils/validation/schemas'

interface BrandListItem {
  id: number;
  name: string;
  slug: string;
}

type BrandsListResponse = BrandListItem[]

export default defineEventHandler(async (event: ApiRequestEvent<{ query: InferInput<typeof brandsListQuerySchema>; }>): Promise<BrandsListResponse> => {
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

export type { BrandsListResponse }
