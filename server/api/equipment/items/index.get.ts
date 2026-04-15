import { and, asc, count, eq, ilike, type SQL } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { brands, equipmentCategories, equipmentItems } from '#server/database/schema'
import { validateItemsListQuery } from '#server/utils/validation/schemas'

interface Brand {
  name: string;
  slug: string;
}

interface Category {
  name: string;
  slug: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  brand: Brand;
  category: Category;
}

interface ReturnData {
  items: EquipmentItem[];
  limit: number;
  page: number;
  total: number;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const { dbHttp } = event.context
  const validatedQuery = await getValidatedQuery(event, validateItemsListQuery)

  const {
    brandSlug,
    categorySlug,
    limit,
    page,
    search
  } = validatedQuery

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

  if (search !== '') {
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
      .orderBy(
        asc(equipmentItems.name),
        asc(equipmentItems.id)
      )
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
