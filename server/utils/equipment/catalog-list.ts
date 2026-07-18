import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL
} from 'drizzle-orm'

import { alias } from 'drizzle-orm/pg-core'
import { createError } from 'h3'

import {
  brands,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues
} from '#server/database/schema'

import type { createHttpClient } from '#server/utils/database'

import type {
  ItemsListBooleanFilter,
  ItemsListEnumFilter,
  ItemsListNumberFilter,
  ItemsListSort,
  validateItemsListQuery
} from '#server/utils/validation/schemas'

type DbHttp = ReturnType<typeof createHttpClient>
type ItemsListQuery = ReturnType<typeof validateItemsListQuery>

interface CatalogListBrand {
  name: string;
  slug: string;
}

interface CatalogListCategory {
  name: string;
  slug: string;
}

interface CatalogListItemRow {
  brand: CatalogListBrand;
  category: CatalogListCategory;
  categoryId: number;
  id: string;
  name: string;
}

interface CatalogListSql {
  orderBy: SQL[];
  sortPropertyId: number | undefined;
  where: SQL | undefined;
}

interface CategoryMetadataEnumOption {
  slug: string;
}

interface CategoryMetadataProperty {
  dataType: string;
  enumOptions: CategoryMetadataEnumOption[];
  id: number;
  slug: string;
}

interface CategoryMetadata {
  properties: CategoryMetadataProperty[];
}

interface EnumFilterGroup {
  optionSlugs: string[];
  propertyId: number;
}

const filterValues = alias(itemPropertyValues, 'filter_values')
const catalogPropertySortValues = alias(itemPropertyValues, 'property_sort_values')

/** Escapes user text for a literal SQL LIKE substring search. */
function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', String.raw`\\`)
    .replaceAll('%', String.raw`\%`)
    .replaceAll('_', String.raw`\_`)
}

/** Creates an EXISTS predicate for one item property and its value constraints. */
function createPropertyExistsCondition(propertyId: number, valueConditions: SQL[]) : SQL {
  const filterCondition = and(
    eq(filterValues.itemId, equipmentItems.id),
    eq(filterValues.propertyId, propertyId),
    ...valueConditions
  )

  return sql`exists (
    select 1
    from ${itemPropertyValues} as ${sql.identifier('filter_values')}
    where ${filterCondition}
  )`
}

/** Creates catalog predicates that do not require category property metadata. */
function createBaseConditions(query: ItemsListQuery) : SQL[] {
  const conditions: SQL[] = [eq(equipmentItems.status, 'approved')]

  if (query.categorySlug !== undefined) {
    conditions.push(eq(equipmentCategories.slug, query.categorySlug))
  }

  if (query.brandSlug.length > 0) {
    const brandCondition = or(...query.brandSlug.map((slug) => eq(brands.slug, slug)))

    if (brandCondition !== undefined) {
      conditions.push(brandCondition)
    }
  }

  if (query.search !== '') {
    const escapedSearch = escapeLikePattern(query.search)
    const containsPattern = `%${escapedSearch}%`

    const searchCondition = or(
      ilike(equipmentItems.name, containsPattern),
      ilike(brands.name, containsPattern),
      ilike(equipmentCategories.name, containsPattern)
    )

    if (searchCondition !== undefined) {
      conditions.push(searchCondition)
    }
  }

  return conditions
}

/** Loads category property metadata only when filtering or sorting requires it. */
async function loadCategoryMetadata(dbHttp: DbHttp, query: ItemsListQuery) : Promise<CategoryMetadata | undefined> {
  const hasPropertyFilters = query.numberFilter.length > 0
    || query.enumFilter.length > 0
    || query.booleanFilter.length > 0

  const requiresMetadata = hasPropertyFilters || query.sort.startsWith('property:')

  if (!requiresMetadata) {
    return undefined
  }

  if (query.categorySlug === undefined) {
    throw createError({ status: 400, message: 'categorySlug is required for property filters and sorting' })
  }

  const metadata = await dbHttp.query.equipmentCategories.findFirst({
    columns: {
      id: true
    },

    where: {
      slug: query.categorySlug
    },

    with: {
      properties: {
        columns: {
          dataType: true,
          id: true,
          slug: true
        },

        with: {
          enumOptions: {
            columns: {
              slug: true
            }
          }
        }
      }
    }
  })

  if (metadata === undefined) {
    throw createError({ status: 400, message: `Unknown equipment category: ${query.categorySlug}` })
  }

  return metadata
}

/** Adds validated numeric property predicates to the catalog query. */
function addNumberConditions(
  conditions: SQL[],
  filters: ItemsListNumberFilter[],
  propertiesBySlug: Map<string, CategoryMetadataProperty>
) {
  for (const filter of filters) {
    const property = propertiesBySlug.get(filter.propertySlug)

    if (property?.dataType !== 'number') {
      throw createError({ status: 400, message: `Unknown numeric property: ${filter.propertySlug}` })
    }

    const valueConditions: SQL[] = []

    if (filter.min !== null) {
      valueConditions.push(gte(filterValues.valueNumber, filter.min))
    }

    if (filter.max !== null) {
      valueConditions.push(lte(filterValues.valueNumber, filter.max))
    }

    conditions.push(createPropertyExistsCondition(property.id, valueConditions))
  }
}

/** Validates and groups enum filters so options of one property use OR semantics. */
function groupEnumFilters(
  filters: ItemsListEnumFilter[],
  propertiesBySlug: Map<string, CategoryMetadataProperty>
) : Map<number, EnumFilterGroup> {
  const groups = new Map<number, EnumFilterGroup>()

  for (const filter of filters) {
    const property = propertiesBySlug.get(filter.propertySlug)

    if (property?.dataType !== 'enum') {
      throw createError({ status: 400, message: `Unknown enum property: ${filter.propertySlug}` })
    }

    const optionExists = property.enumOptions.some((option) => option.slug === filter.optionSlug)

    if (!optionExists) {
      throw createError({
        status: 400,
        message: `Unknown option ${filter.optionSlug} for property ${filter.propertySlug}`
      })
    }

    const group = groups.get(property.id)

    if (group === undefined) {
      groups.set(property.id, { optionSlugs: [filter.optionSlug], propertyId: property.id })
    } else {
      group.optionSlugs.push(filter.optionSlug)
    }
  }

  return groups
}

/** Adds grouped enum property predicates to the catalog query. */
function addEnumConditions(conditions: SQL[], groups: Map<number, EnumFilterGroup>) {
  for (const group of groups.values()) {
    const optionCondition = or(
      ...group.optionSlugs.map((optionSlug) => eq(filterValues.valueText, optionSlug))
    )

    if (optionCondition !== undefined) {
      conditions.push(createPropertyExistsCondition(group.propertyId, [optionCondition]))
    }
  }
}

/** Adds validated boolean property predicates to the catalog query. */
function addBooleanConditions(
  conditions: SQL[],
  filters: ItemsListBooleanFilter[],
  propertiesBySlug: Map<string, CategoryMetadataProperty>
) {
  for (const filter of filters) {
    const property = propertiesBySlug.get(filter.propertySlug)

    if (property?.dataType !== 'boolean') {
      throw createError({ status: 400, message: `Unknown boolean property: ${filter.propertySlug}` })
    }

    const valueCondition = eq(filterValues.valueBoolean, filter.value)

    conditions.push(createPropertyExistsCondition(property.id, [valueCondition]))
  }
}

/** Resolves and validates the numeric property used for property sorting. */
function resolveSortPropertyId(
  sort: ItemsListSort,
  propertiesBySlug: Map<string, CategoryMetadataProperty>
) : number | undefined {
  if (!sort.startsWith('property:')) {
    return undefined
  }

  const propertySlug = sort.slice('property:'.length)
  const property = propertiesBySlug.get(propertySlug)

  if (property?.dataType !== 'number') {
    throw createError({ status: 400, message: `Unknown numeric sort property: ${propertySlug}` })
  }

  return property.id
}

/** Creates stable catalog ordering with item ID as the final tie-breaker. */
function createOrderBy(query: ItemsListQuery, sortPropertyId: number | undefined) : SQL[] {
  if (query.sort === 'brand') {
    const brandOrder = query.direction === 'asc' ? asc(brands.name) : desc(brands.name)

    return [brandOrder, asc(equipmentItems.name), asc(equipmentItems.id)]
  }

  if (sortPropertyId === undefined) {
    const nameOrder = query.direction === 'asc' ? asc(equipmentItems.name) : desc(equipmentItems.name)

    return [nameOrder, asc(equipmentItems.id)]
  }

  const propertyOrder = query.direction === 'asc'
    ? sql`${catalogPropertySortValues.valueNumber} asc nulls last`
    : sql`${catalogPropertySortValues.valueNumber} desc nulls last`

  return [propertyOrder, asc(equipmentItems.name), asc(equipmentItems.id)]
}

/** Resolves category-aware filters into the shared list/count predicate and stable ordering. */
async function buildCatalogListSql(dbHttp: DbHttp, query: ItemsListQuery) : Promise<CatalogListSql> {
  const conditions = createBaseConditions(query)
  const metadata = await loadCategoryMetadata(dbHttp, query)
  const metadataProperties = metadata?.properties.map((property) => [property.slug, property] as const)
  const propertiesBySlug = new Map(metadataProperties)

  addNumberConditions(conditions, query.numberFilter, propertiesBySlug)

  const enumGroups = groupEnumFilters(query.enumFilter, propertiesBySlug)

  addEnumConditions(conditions, enumGroups)
  addBooleanConditions(conditions, query.booleanFilter, propertiesBySlug)

  const sortPropertyId = resolveSortPropertyId(query.sort, propertiesBySlug)

  return {
    orderBy: createOrderBy(query, sortPropertyId),
    sortPropertyId,
    where: and(...conditions)
  }
}

export {
  buildCatalogListSql,
  catalogPropertySortValues
}

export type {
  CatalogListBrand,
  CatalogListCategory,
  CatalogListItemRow,
  CatalogListSql
}
