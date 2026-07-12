import type { LocationQuery } from 'vue-router'
import { describe, expect, it } from 'vitest'
import {
  type GearLibraryRouteState,
  buildGearLibraryRouteQuery,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState,
  isGearLibraryRouteQueryCanonical
} from '../gear-library'

function createRouteState(overrides: Partial<GearLibraryRouteState> = {}): GearLibraryRouteState {
  return {
    batch: 1,
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

describe(getGearLibraryRouteState, () => {
  it('should normalize all supported route query values', () => {
    const result = getGearLibraryRouteState({
      batch: [' 3 ', '8'],
      boolean: ['windproof:true', '', 'freestanding:false', 'windproof:true', null],
      brand: ['therm-a-rest', 'msr', '', 'msr', null],
      category: ['  sleeping-pads  ', 'ignored'],
      compare: ['second-id', '', null, 'first-id', 'second-id'],
      direction: [' desc ', 'asc'],
      enum: ['fuel:wood', 'fuel:gas', 'fuel:wood'],
      number: ['weight:1:2', null, 'capacity:3:4', 'weight:1:2'],
      page: '999',
      q: ['  insulated pad  ', 'ignored'],
      sort: [' property:weight ', 'brand'],
      unknown: 'ignored'
    })

    expect(result).toStrictEqual({
      batch: 3,
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
      batch: '0',
      category: '   ',
      direction: 'sideways',
      q: null,
      sort: 'recent'
    })

    expect(result).toStrictEqual({
      batch: 1,
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

  it.each(['', '0', '-2', '1.5', 'wat'])(
    'should default invalid batch=%j to the first batch',
    (batch) => {
      const result = getGearLibraryRouteState({ batch })

      expect(result.batch).toBe(1)
    }
  )

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
      batch: 4,
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
      numberFilter: ['weight:1:2'],
      page: 3,
      search: 'pocket rocket',
      sort: 'property:weight'
    })
  })

  it('should keep empty API values and exclude route-only state', () => {
    const result = getGearLibraryItemsApiQuery(createRouteState({
      batch: 5,
      compare: ['item-id']
    }), 1)

    expect(result).toStrictEqual({
      booleanFilter: [],
      brandSlug: [],
      categorySlug: undefined,
      direction: 'asc',
      enumFilter: [],
      numberFilter: [],
      page: 1,
      search: '',
      sort: 'name'
    })
  })
})

describe(buildGearLibraryRouteQuery, () => {
  it('should emit the canonical route keys in their fixed order', () => {
    const routeState = createRouteState({
      batch: 2,
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
      'batch',
      'compare'
    ])
    expect(result).toStrictEqual({
      batch: '2',
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
      page: '8',
      q: 'pad',
      tracking: 'source',
      category: 'sleeping-pads',
      brand: ['msr', 'therm-a-rest'],
      number: 'weight:1:2',
      enum: 'insulation:down',
      boolean: 'insulated:true',
      sort: 'property:weight',
      direction: 'desc',
      batch: '2',
      compare: ['second-id', 'first-id', 'second-id']
    })

    expect(result).toBe(true)
  })

  it('should accept page and unknown keys when no supported normalization is needed', () => {
    expect(isGearLibraryRouteQueryCanonical({ page: '999', unknown: 'value' })).toBe(true)
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
    [{ batch: '1' }, 'an explicit default batch'],
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
