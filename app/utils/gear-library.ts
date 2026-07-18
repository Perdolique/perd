import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw
} from 'vue-router'
import type {
  GearLibraryItemsResponse,
  GearLibraryListItem
} from '~/types/equipment'

type GearLibrarySort = 'name' | 'brand' | `property:${string}`
type GearLibraryDirection = 'asc' | 'desc'

interface GearLibraryOrdering {
  direction: GearLibraryDirection;
  sort: GearLibrarySort;
}

interface GearLibraryRouteState {
  q: string;
  category?: string;
  brand: string[];
  number: string[];
  enum: string[];
  boolean: string[];
  sort: GearLibrarySort;
  direction: GearLibraryDirection;
  compare: string[];
}

interface GearLibraryItemsApiQuery {
  search: string;
  categorySlug?: string;
  brandSlug: string[];
  numberFilter: string[];
  enumFilter: string[];
  booleanFilter: string[];
  sort: GearLibrarySort;
  direction: GearLibraryDirection;
  limit: number;
  page: number;
}

interface SupportedQueryEntry {
  key: string;
  values: LocationQueryValueRaw[];
}

const routeQueryKeys = [
  'q',
  'category',
  'brand',
  'number',
  'enum',
  'boolean',
  'sort',
  'direction',
  'compare'
] as const

const routeQueryKeySet: ReadonlySet<string> = new Set(routeQueryKeys)
const gearLibraryPageSize = 10

function getSingleQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeScalarQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const singleValue = getSingleQueryValue(value)

  return singleValue?.trim() ?? ''
}

function getNonEmptyQueryValues(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  if (value === undefined) {
    return []
  }

  const values = Array.isArray(value) ? value : [value]

  return values.filter((queryValue): queryValue is string => queryValue !== null && queryValue !== '')
}

function normalizeSortedQueryValues(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const nonEmptyValues = getNonEmptyQueryValues(value)
  const uniqueValues = new Set(nonEmptyValues)

  return [...uniqueValues].toSorted()
}

function isGearLibrarySort(value: string): value is GearLibrarySort {
  const isNamedSort = value === 'name' || value === 'brand'
  const propertySortPrefix = 'property:'
  const hasPropertySlug = value.startsWith(propertySortPrefix) && value.length > propertySortPrefix.length

  return isNamedSort || hasPropertySlug
}

function normalizeSortQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): GearLibrarySort {
  const normalizedValue = normalizeScalarQueryValue(value)
  const isSupportedSort = isGearLibrarySort(normalizedValue)

  if (isSupportedSort) {
    return normalizedValue
  }

  return 'name'
}

function normalizeDirectionQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): GearLibraryDirection {
  const normalizedValue = normalizeScalarQueryValue(value)

  if (normalizedValue === 'desc') {
    return 'desc'
  }

  return 'asc'
}

function getGearLibraryRouteState(query: LocationQuery): GearLibraryRouteState {
  const category = normalizeScalarQueryValue(query.category)

  const routeState: GearLibraryRouteState = {
    boolean: normalizeSortedQueryValues(query.boolean),
    brand: normalizeSortedQueryValues(query.brand),
    compare: getNonEmptyQueryValues(query.compare),
    direction: normalizeDirectionQueryValue(query.direction),
    enum: normalizeSortedQueryValues(query.enum),
    number: normalizeSortedQueryValues(query.number),
    q: normalizeScalarQueryValue(query.q),
    sort: normalizeSortQueryValue(query.sort)
  }

  if (category !== '') {
    routeState.category = category
  }

  return routeState
}

function getGearLibraryItemsApiQuery(
  routeState: GearLibraryRouteState,
  page: number
): GearLibraryItemsApiQuery {
  return {
    booleanFilter: routeState.boolean,
    brandSlug: routeState.brand,
    categorySlug: routeState.category,
    direction: routeState.direction,
    enumFilter: routeState.enum,
    limit: gearLibraryPageSize,
    numberFilter: routeState.number,
    page,
    search: routeState.q,
    sort: routeState.sort
  }
}

function getGearLibraryTotalPages(response: GearLibraryItemsResponse) {
  return Math.max(Math.ceil(response.total / response.limit), 1)
}

function clampGearLibraryPageCount(desiredPageCount: number, totalPages: number) {
  return Math.min(Math.max(desiredPageCount, 1), totalPages)
}

function getUniqueGearLibraryItems(pages: GearLibraryItemsResponse[]): GearLibraryListItem[] {
  const itemIds = new Set<string>()
  const items: GearLibraryListItem[] = []

  for (const page of pages) {
    for (const item of page.items) {
      const isNewItem = itemIds.has(item.id) === false

      if (isNewItem) {
        itemIds.add(item.id)
        items.push(item)
      }
    }
  }

  return items
}

function buildGearLibraryRouteQuery(routeState: GearLibraryRouteState): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (routeState.q !== '') {
    query.q = routeState.q
  }

  if (routeState.category !== undefined && routeState.category !== '') {
    query.category = routeState.category
  }

  if (routeState.brand.length > 0) {
    query.brand = routeState.brand
  }

  if (routeState.number.length > 0) {
    query.number = routeState.number
  }

  if (routeState.enum.length > 0) {
    query.enum = routeState.enum
  }

  if (routeState.boolean.length > 0) {
    query.boolean = routeState.boolean
  }

  if (routeState.sort !== 'name') {
    query.sort = routeState.sort
  }

  if (routeState.direction !== 'asc') {
    query.direction = routeState.direction
  }

  if (routeState.compare.length > 0) {
    query.compare = routeState.compare
  }

  return query
}

function getSupportedQueryEntries(query: LocationQuery | LocationQueryRaw): SupportedQueryEntry[] {
  const entries: SupportedQueryEntry[] = []

  for (const key of Object.keys(query)) {
    const isSupported = routeQueryKeySet.has(key)

    if (isSupported) {
      const value = query[key]
      const values = Array.isArray(value) ? value : [value]

      entries.push({ key, values })
    }
  }

  return entries
}

function areSupportedQueryEntriesEqual(
  currentEntries: SupportedQueryEntry[],
  canonicalEntries: SupportedQueryEntry[]
) {
  if (currentEntries.length !== canonicalEntries.length) {
    return false
  }

  for (const [index, currentEntry] of currentEntries.entries()) {
    const canonicalEntry = canonicalEntries[index]

    if (canonicalEntry === undefined || currentEntry.key !== canonicalEntry.key) {
      return false
    }

    if (currentEntry.values.length !== canonicalEntry.values.length) {
      return false
    }

    const hasDifferentValue = currentEntry.values.some((value, valueIndex) => (
      value !== canonicalEntry.values[valueIndex]
    ))

    if (hasDifferentValue) {
      return false
    }
  }

  return true
}

function isGearLibraryRouteQueryCanonical(query: LocationQuery) {
  if (query.batch !== undefined) {
    return false
  }

  const routeState = getGearLibraryRouteState(query)
  const canonicalQuery = buildGearLibraryRouteQuery(routeState)
  const currentEntries = getSupportedQueryEntries(query)
  const canonicalEntries = getSupportedQueryEntries(canonicalQuery)

  return areSupportedQueryEntriesEqual(currentEntries, canonicalEntries)
}

export type {
  GearLibraryDirection,
  GearLibraryItemsApiQuery,
  GearLibraryOrdering,
  GearLibraryRouteState,
  GearLibrarySort
}

export {
  buildGearLibraryRouteQuery,
  clampGearLibraryPageCount,
  gearLibraryPageSize,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  getGearLibraryTotalPages,
  getUniqueGearLibraryItems,
  isGearLibraryRouteQueryCanonical
}
