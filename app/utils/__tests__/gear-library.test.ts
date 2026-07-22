import type { LocationQuery } from 'vue-router'
import { describe, expect, it } from 'vitest'
import type { GearLibraryItemsResponse, GearLibraryListItem } from '../../types/equipment'
import {
  type GearLibraryRouteState,
  buildGearLibraryRouteQuery,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  getRestorableGearLibraryPages,
  getGearLibraryTotalPages,
  getUniqueGearLibraryItems,
  isGearLibraryRouteQueryCanonical
} from '../gear-library'
import { normalizeGearLibraryComparisonQuery } from '../gear-library-comparison'

const firstComparisonId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1'
const secondComparisonId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2'
const thirdComparisonId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d3'
const fourthComparisonId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d4'
const fifthComparisonId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d5'

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
      compare: [secondComparisonId, '', null, firstComparisonId, secondComparisonId],
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
      compare: [secondComparisonId, firstComparisonId],
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

describe(normalizeGearLibraryComparisonQuery, () => {
  it('should preserve the first four unique canonical UUIDv7 IDs in order', () => {
    const result = normalizeGearLibraryComparisonQuery([
      secondComparisonId,
      firstComparisonId,
      secondComparisonId,
      thirdComparisonId,
      fourthComparisonId,
      fifthComparisonId
    ], 'stoves')

    expect(result).toStrictEqual({
      ids: [
        secondComparisonId,
        firstComparisonId,
        thirdComparisonId,
        fourthComparisonId
      ],
      hasDuplicateIds: true,
      hasInvalidIds: false,
      hasOverLimitIds: true,
      wasClearedForMissingCategory: false
    })
  })

  it('should reject malformed, uppercase, empty, and null IDs', () => {
    const result = normalizeGearLibraryComparisonQuery([
      'item-id',
      firstComparisonId.toUpperCase(),
      '',
      null,
      firstComparisonId
    ], 'stoves')

    expect(result).toStrictEqual({
      ids: [firstComparisonId],
      hasDuplicateIds: false,
      hasInvalidIds: true,
      hasOverLimitIds: false,
      wasClearedForMissingCategory: false
    })
  })

  it('should clear comparison state when no category is selected', () => {
    const result = normalizeGearLibraryComparisonQuery(firstComparisonId)

    expect(result).toStrictEqual({
      ids: [],
      hasDuplicateIds: false,
      hasInvalidIds: false,
      hasOverLimitIds: false,
      wasClearedForMissingCategory: true
    })
  })

  it('should report no adjustment when comparison state is absent', () => {
    const result = normalizeGearLibraryComparisonQuery()

    expect(result).toStrictEqual({
      ids: [],
      hasDuplicateIds: false,
      hasInvalidIds: false,
      hasOverLimitIds: false,
      wasClearedForMissingCategory: false
    })
  })
})

describe(getGearLibraryItemsApiQuery, () => {
  it('should map route state to the equipment items API query', () => {
    const routeState = createRouteState({
      boolean: ['freestanding:true'],
      brand: ['msr'],
      category: 'stoves',
      compare: [firstComparisonId],
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
      compare: [firstComparisonId]
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

describe(getRestorableGearLibraryPages, () => {
  const cachedPages = [
    createItemsResponse(1, ['first'], 30),
    createItemsResponse(2, ['second'], 30),
    createItemsResponse(3, ['third'], 30)
  ]

  it('should return the exact complete cached prefix', () => {
    expect(getRestorableGearLibraryPages(cachedPages, 2)).toStrictEqual(cachedPages.slice(0, 2))
  })

  it.each([
    { loadedPageCount: 100, pages: cachedPages },
    { loadedPageCount: 3, pages: cachedPages.slice(0, 2) },
    {
      loadedPageCount: 2,
      pages: [
        createItemsResponse(1, ['first'], 30),
        createItemsResponse(3, ['third'], 30)
      ]
    }
  ])('should reject an unsafe cached prefix', ({ loadedPageCount, pages }) => {
    expect(getRestorableGearLibraryPages(pages, loadedPageCount)).toStrictEqual([])
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

describe(buildGearLibraryRouteQuery, () => {
  it('should emit the canonical route keys in their fixed order', () => {
    const routeState = createRouteState({
      boolean: ['freestanding:true'],
      brand: ['msr'],
      category: 'stoves',
      compare: [secondComparisonId, firstComparisonId],
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
      compare: [secondComparisonId, firstComparisonId],
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
      compare: [secondComparisonId, firstComparisonId]
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
    [{ compare: [firstComparisonId, ''] }, 'empty compare values'],
    [{ compare: [firstComparisonId, firstComparisonId] }, 'duplicate compare values'],
    [{ compare: ['item-id'] }, 'malformed compare values'],
    [{ compare: firstComparisonId }, 'comparison without a category'],
    [{ brand: 'msr', q: 'pad' }, 'supported keys in the wrong order'],
    [{ sort: 'property:' }, 'a property sort without a property'],
    [{ sort: 'recent' }, 'an invalid sort']
  ]

  it.each(nonCanonicalQueries)('should reject %s (%s)', (query) => {
    expect(isGearLibraryRouteQueryCanonical(query)).toBe(false)
  })
})
