import type { LocationQuery } from 'vue-router'
import { describe, expect, it } from 'vitest'
import type { GearLibraryItemsResponse, GearLibraryListItem } from '../../types/equipment'
import {
  type GearLibraryRouteState,
  buildGearLibraryRouteQuery,
  clampGearLibraryPageCount,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  getGearLibraryTotalPages,
  getUniqueGearLibraryItems,
  isGearLibraryRouteQueryCanonical
} from '../gear-library'
import {
  getCanonicalGearLibraryReturnPath,
  sanitizeGearLibraryReturnPath
} from '../gear-library-return-path'

function createRouteState(overrides: Partial<GearLibraryRouteState> = {}): GearLibraryRouteState {
  return {
    boolean: [],
    brand: [],
    compare: [],
    direction: 'asc',
    enum: [],
    number: [],
    q: '',
    sort: 'name',
    ...overrides
  }
}

function createListItem(id: string): GearLibraryListItem {
  return {
    id,
    name: `Item ${id}`,
    properties: [],

    brand: {
      name: 'MSR',
      slug: 'msr'
    },

    category: {
      name: 'Stoves',
      slug: 'stoves'
    }
  }
}

function createItemsResponse(
  page: number,
  itemIds: string[],
  total = itemIds.length
): GearLibraryItemsResponse {
  return {
    items: itemIds.map((itemId) => createListItem(itemId)),
    limit: 10,
    page,
    total
  }
}

describe(getGearLibraryRouteState, () => {
  it('should normalize all supported route query values', () => {
    const result = getGearLibraryRouteState({
      boolean: ['windproof:true', '', 'freestanding:false', 'windproof:true', null],
      brand: ['therm-a-rest', 'msr', '', 'msr', null],
      category: ['  sleeping-pads  ', 'ignored'],
      compare: ['second-id', '', null, 'first-id', 'second-id'],
      direction: [' desc ', 'asc'],
      enum: ['fuel:wood', 'fuel:gas', 'fuel:wood'],
      number: ['weight:1:2', null, 'capacity:3:4', 'weight:1:2'],
      q: ['  insulated pad  ', 'ignored'],
      sort: [' property:weight ', 'brand'],
      unknown: 'ignored'
    })

    expect(result).toStrictEqual({
      boolean: ['freestanding:false', 'windproof:true'],
      brand: ['msr', 'therm-a-rest'],
      category: 'sleeping-pads',
      compare: ['second-id', 'first-id', 'second-id'],
      direction: 'desc',
      enum: ['fuel:gas', 'fuel:wood'],
      number: ['capacity:3:4', 'weight:1:2'],
      q: 'insulated pad',
      sort: 'property:weight'
    })
  })

  it('should return defaults for empty and invalid scalar values', () => {
    const result = getGearLibraryRouteState({
      category: '   ',
      direction: 'sideways',
      q: null,
      sort: 'recent'
    })

    expect(result).toStrictEqual({
      boolean: [],
      brand: [],
      compare: [],
      direction: 'asc',
      enum: [],
      number: [],
      q: '',
      sort: 'name'
    })
  })

  it('should deduplicate repeatable filters by exact value', () => {
    const result = getGearLibraryRouteState({
      brand: ['msr', 'MSR', 'msr']
    })

    expect(result.brand).toStrictEqual(['MSR', 'msr'])
  })
})

describe(getGearLibraryItemsApiQuery, () => {
  it('should map route state to the equipment items API query', () => {
    const routeState = createRouteState({
      boolean: ['freestanding:true'],
      brand: ['msr'],
      category: 'stoves',
      compare: ['item-id'],
      direction: 'desc',
      enum: ['fuel:gas'],
      number: ['weight:1:2'],
      q: 'pocket rocket',
      sort: 'property:weight'
    })

    const result = getGearLibraryItemsApiQuery(routeState, 3)

    expect(result).toStrictEqual({
      booleanFilter: ['freestanding:true'],
      brandSlug: ['msr'],
      categorySlug: 'stoves',
      direction: 'desc',
      enumFilter: ['fuel:gas'],
      limit: 10,
      numberFilter: ['weight:1:2'],
      page: 3,
      search: 'pocket rocket',
      sort: 'property:weight'
    })
  })

  it('should keep empty API values and exclude route-only state', () => {
    const result = getGearLibraryItemsApiQuery(createRouteState({
      compare: ['item-id']
    }), 1)

    expect(result).toStrictEqual({
      booleanFilter: [],
      brandSlug: [],
      categorySlug: undefined,
      direction: 'asc',
      enumFilter: [],
      limit: 10,
      numberFilter: [],
      page: 1,
      search: '',
      sort: 'name'
    })
  })
})

describe(getGearLibraryTotalPages, () => {
  it.each([
    [0, 1],
    [1, 1],
    [10, 1],
    [11, 2],
    [30, 3]
  ])('should map a total of %i to %i pages', (total, expectedPages) => {
    const response = createItemsResponse(1, [], total)

    expect(getGearLibraryTotalPages(response)).toBe(expectedPages)
  })
})

describe(clampGearLibraryPageCount, () => {
  it.each([
    [1, 3, 1],
    [2, 3, 2],
    [99, 3, 3]
  ])('should clamp desired page count %i against %i pages to %i', (pageCount, totalPages, expectedCount) => {
    expect(clampGearLibraryPageCount(pageCount, totalPages)).toBe(expectedCount)
  })
})

describe(getUniqueGearLibraryItems, () => {
  it('should preserve the first occurrence order while removing later duplicate IDs', () => {
    const pages = [
      createItemsResponse(1, ['first', 'duplicate'], 4),
      createItemsResponse(2, ['duplicate', 'last'], 4)
    ]

    const result = getUniqueGearLibraryItems(pages)

    expect(result.map((item) => item.id)).toStrictEqual(['first', 'duplicate', 'last'])
  })
})

describe(sanitizeGearLibraryReturnPath, () => {
  it('should keep only canonical supported catalog query state', () => {
    const result = sanitizeGearLibraryReturnPath(
      '/gear-library?brand=zeta&brand=alpha&brand=alpha&debug=1&q=%20pad%20&direction=desc'
    )

    expect(result).toBe('/gear-library?q=pad&brand=alpha&brand=zeta&direction=desc')
  })

  it('should use the router query encoding while dropping unsupported state', () => {
    const result = sanitizeGearLibraryReturnPath('/gear-library?q=foo~bar&debug=1')

    expect(result).toBe('/gear-library?q=foo~bar')
  })

  it.each([
    ['/gear-library?debug=1', '/gear-library'],
    ['/gear-library?q=foo~bar', '/gear-library?q=foo~bar'],
    ['/settings', null]
  ])('should expose the canonical match for history path %j', (returnPath, expectedPath) => {
    expect(getCanonicalGearLibraryReturnPath(returnPath)).toBe(expectedPath)
  })

  it.each([
    undefined,
    null,
    '',
    ['gear-library', '/gear-library'],
    'https://evil.example/gear-library',
    '//evil.example/gear-library',
    '/my-gear',
    '/gear-library/item-id',
    '/gear-library#results'
  ])('should fall back for an unsafe return path %j', (returnPath) => {
    expect(sanitizeGearLibraryReturnPath(returnPath)).toBe('/gear-library')
  })
})

describe(buildGearLibraryRouteQuery, () => {
  it('should emit the canonical route keys in their fixed order', () => {
    const routeState = createRouteState({
      boolean: ['freestanding:true'],
      brand: ['msr'],
      category: 'stoves',
      compare: ['second-id', 'first-id', 'second-id'],
      direction: 'desc',
      enum: ['fuel:gas'],
      number: ['weight:1:2'],
      q: 'pocket rocket',
      sort: 'property:weight'
    })

    const result = buildGearLibraryRouteQuery(routeState)

    expect(Object.keys(result)).toStrictEqual([
      'q',
      'category',
      'brand',
      'number',
      'enum',
      'boolean',
      'sort',
      'direction',
      'compare'
    ])
    expect(result).toStrictEqual({
      boolean: ['freestanding:true'],
      brand: ['msr'],
      category: 'stoves',
      compare: ['second-id', 'first-id', 'second-id'],
      direction: 'desc',
      enum: ['fuel:gas'],
      number: ['weight:1:2'],
      q: 'pocket rocket',
      sort: 'property:weight'
    })
  })

  it('should omit empty and default route values', () => {
    const result = buildGearLibraryRouteQuery(createRouteState())

    expect(result).toStrictEqual({})
  })
})

describe(isGearLibraryRouteQueryCanonical, () => {
  it('should accept a canonical supported query with unsupported keys interleaved', () => {
    const result = isGearLibraryRouteQueryCanonical({
      q: 'pad',
      tracking: 'source',
      category: 'sleeping-pads',
      brand: ['msr', 'therm-a-rest'],
      number: 'weight:1:2',
      enum: 'insulation:down',
      boolean: 'insulated:true',
      sort: 'property:weight',
      direction: 'desc',
      compare: ['second-id', 'first-id', 'second-id']
    })

    expect(result).toBe(true)
  })

  it('should accept unknown keys when no supported normalization is needed', () => {
    expect(isGearLibraryRouteQueryCanonical({ unknown: 'value' })).toBe(true)
  })

  it('should treat one repeatable value and its scalar URL representation as equivalent', () => {
    expect(isGearLibraryRouteQueryCanonical({ brand: 'msr' })).toBe(true)
  })

  const nonCanonicalQueries: [LocationQuery, string][] = [
    [{ q: '' }, 'an explicit empty default'],
    [{ q: '  pad  ' }, 'an untrimmed scalar'],
    [{ q: ['pad', 'tent'] }, 'duplicate scalar keys'],
    [{ sort: 'name' }, 'an explicit default sort'],
    [{ direction: 'asc' }, 'an explicit default direction'],
    [{ batch: '100' }, 'removed browsing depth state'],
    [{ brand: ['therm-a-rest', 'msr'] }, 'unsorted filters'],
    [{ brand: ['msr', 'msr'] }, 'duplicate filters'],
    [{ compare: ['item-id', ''] }, 'empty compare values'],
    [{ brand: 'msr', q: 'pad' }, 'supported keys in the wrong order'],
    [{ sort: 'property:' }, 'a property sort without a property'],
    [{ sort: 'recent' }, 'an invalid sort']
  ]

  it.each(nonCanonicalQueries)('should reject %s (%s)', (query) => {
    expect(isGearLibraryRouteQueryCanonical(query)).toBe(false)
  })
})
