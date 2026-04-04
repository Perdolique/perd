import { and, count, eq, ilike, type SQL } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { brands, equipmentCategories, equipmentItems } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { dbHttp } = event.context
  const categorySlug = typeof query.categorySlug === 'string' ? query.categorySlug : undefined
  const brandSlug = typeof query.brandSlug === 'string' ? query.brandSlug : undefined
  const search = typeof query.search === 'string' ? query.search : undefined
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)))

  const conditions: SQL[] = [
    eq(equipmentItems.status, 'approved')
  ]

  if (categorySlug !== undefined && categorySlug !== '') {
    conditions.push(
      eq(equipmentCategories.slug, categorySlug)
    )
  }

  if (brandSlug !== undefined && brandSlug !== '') {
    conditions.push(
      eq(brands.slug, brandSlug)
    )
  }

  if (search !== undefined && search !== '') {
    const escapedSearch = search
      .replaceAll('%', String.raw`\%`)
      .replaceAll('_', String.raw`\_`)

    conditions.push(
      ilike(equipmentItems.name, `%${escapedSearch}%`)
    )
  }

  const where = and(...conditions)

  const [items, countRows] = await Promise.all([
    dbHttp
      .select({
        id: equipmentItems.id,
        name: equipmentItems.name,

        brand: {
          name: brands.name,
          slug: brands.slug
        },

        category: {
          name: equipmentCategories.name,
          slug: equipmentCategories.slug
        }
      })
      .from(equipmentItems)
      .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
      .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
      .where(where)
      .limit(limit)
      .offset((page - 1) * limit),

    dbHttp
      .select({ total: count() })
      .from(equipmentItems)
      .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
      .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
      .where(where)
  ])

  const total = countRows[0]?.total ?? 0

  return {
    items,
    limit,
    page,
    total
  }
})
