import { describe, expect, it } from 'vitest'
import {
  createGearLibraryAppliedFilterChips,
  createGearLibraryFilterDraft,
  getGearLibraryAppliedFilterCount,
  getGearLibraryNumberRangeErrors,
  normalizeGearLibraryFilterDraft,
  removeGearLibraryAppliedFilter,
  type GearLibraryAppliedFilters,
  type GearLibraryFilterDraft
} from '../gear-library-filters'

const appliedFilters: GearLibraryAppliedFilters = {
  boolean: ['piezo-ignition:true'],
  brand: ['msr'],
  enum: ['fuel-type:canister'],
  number: ['weight:80:100']
}

describe(createGearLibraryFilterDraft, () => {
  it('should create editable fields from supported applied filters', () => {
    const result = createGearLibraryFilterDraft(appliedFilters)

    expect({
      boolean: { ...result.boolean },
      brand: result.brand,
      enum: { ...result.enum },
      number: { ...result.number }
    }).toStrictEqual({
      boolean: {
        'piezo-ignition': 'true'
      },
      brand: ['msr'],
      enum: {
        'fuel-type': ['canister']
      },
      number: {
        weight: {
          max: '100',
          min: '80'
        }
      }
    })
  })

  it('should ignore malformed filters that cannot be represented by the form', () => {
    const result = createGearLibraryFilterDraft({
      boolean: ['broken', 'enabled:maybe'],
      brand: ['msr'],
      enum: ['broken'],
      number: ['broken']
    })

    expect({
      boolean: { ...result.boolean },
      brand: result.brand,
      enum: { ...result.enum },
      number: { ...result.number }
    }).toStrictEqual({
      boolean: {},
      brand: ['msr'],
      enum: {},
      number: {}
    })
  })

  it('should preserve property slugs that collide with object prototype keys', () => {
    const result = createGearLibraryFilterDraft({
      boolean: ['constructor:true', 'toString:false', '__proto__:true'],
      brand: [],
      enum: ['constructor:first', 'constructor:second', 'toString:third', '__proto__:fourth'],
      number: ['constructor:1:2', 'toString:3:4', '__proto__:5:6']
    })

    expect(Object.entries(result.boolean)).toStrictEqual([
      ['constructor', 'true'],
      ['toString', 'false'],
      ['__proto__', 'true']
    ])
    expect(Object.entries(result.enum)).toStrictEqual([
      ['constructor', ['first', 'second']],
      ['toString', ['third']],
      ['__proto__', ['fourth']]
    ])
    expect(Object.entries(result.number)).toStrictEqual([
      ['constructor', { max: '2', min: '1' }],
      ['toString', { max: '4', min: '3' }],
      ['__proto__', { max: '6', min: '5' }]
    ])
  })
})

describe(normalizeGearLibraryFilterDraft, () => {
  it('should normalize, deduplicate, and sort form values for the URL', () => {
    const draft: GearLibraryFilterDraft = {
      boolean: {
        freestanding: 'any',
        'piezo-ignition': 'false'
      },
      brand: ['therm-a-rest', 'msr', 'msr'],
      enum: {
        'fuel-type': ['wood', 'canister', 'wood']
      },
      number: {
        capacity: {
          max: '',
          min: ''
        },
        weight: {
          max: ' 100.0 ',
          min: '080'
        }
      }
    }

    const result = normalizeGearLibraryFilterDraft(draft)

    expect(result).toStrictEqual({
      boolean: ['piezo-ignition:false'],
      brand: ['msr', 'therm-a-rest'],
      enum: ['fuel-type:canister', 'fuel-type:wood'],
      number: ['weight:80:100']
    })
  })

  it('should normalize decimals without converting them to exponent notation', () => {
    const draft: GearLibraryFilterDraft = {
      boolean: {},
      brand: [],
      enum: {},
      number: {
        large: {
          max: '',
          min: '1000000000000000000000'
        },
        small: {
          max: '+001.2300',
          min: '0.0000001'
        },
        zero: {
          max: '000.000',
          min: '-0'
        }
      }
    }

    const result = normalizeGearLibraryFilterDraft(draft)

    expect(result.number).toStrictEqual([
      'large:1000000000000000000000:',
      'small:0.0000001:1.23',
      'zero:0:0'
    ])
  })
})

describe(getGearLibraryNumberRangeErrors, () => {
  it('should reject non-numeric and reversed ranges', () => {
    const result = getGearLibraryNumberRangeErrors({
      boolean: {},
      brand: [],
      enum: {},
      number: {
        capacity: {
          max: '10',
          min: 'many'
        },
        weight: {
          max: '80',
          min: '100'
        },
        precise: {
          max: '9007199254740992',
          min: '9007199254740993'
        }
      }
    })

    expect({ ...result }).toStrictEqual({
      capacity: 'Enter valid numbers.',
      precise: 'Minimum must not exceed maximum.',
      weight: 'Minimum must not exceed maximum.'
    })
  })

  it('should use the API decimal grammar and finite number contract', () => {
    const result = getGearLibraryNumberRangeErrors({
      boolean: {},
      brand: [],
      enum: {},
      number: {
        exponent: {
          max: '',
          min: '1e-7'
        },
        hexadecimal: {
          max: '',
          min: '0x10'
        },
        overflow: {
          max: '',
          min: '9'.repeat(400)
        },
        signed: {
          max: '+001.2300',
          min: '-0'
        },
        small: {
          max: '',
          min: '0.0000001'
        }
      }
    })

    expect({ ...result }).toStrictEqual({
      exponent: 'Enter valid numbers.',
      hexadecimal: 'Enter valid numbers.',
      overflow: 'Enter valid numbers.'
    })
  })

  it('should report errors for property slugs that collide with object prototype keys', () => {
    const draft = createGearLibraryFilterDraft({
      boolean: [],
      brand: [],
      enum: [],
      number: ['constructor:invalid:', 'toString:invalid:', '__proto__:invalid:']
    })

    const result = getGearLibraryNumberRangeErrors(draft)

    expect(Object.entries(result)).toStrictEqual([
      ['constructor', 'Enter valid numbers.'],
      ['toString', 'Enter valid numbers.'],
      ['__proto__', 'Enter valid numbers.']
    ])
  })
})

describe(removeGearLibraryAppliedFilter, () => {
  it('should remove only the selected applied filter', () => {
    const result = removeGearLibraryAppliedFilter(appliedFilters, {
      kind: 'enum',
      value: 'fuel-type:canister'
    })

    expect(result).toStrictEqual({
      ...appliedFilters,
      enum: []
    })
    expect(appliedFilters.enum).toStrictEqual(['fuel-type:canister'])
  })
})

describe(createGearLibraryAppliedFilterChips, () => {
  it('should create one labeled removable chip for every applied filter', () => {
    const result = createGearLibraryAppliedFilterChips(appliedFilters, {
      brands: [{ name: 'MSR', slug: 'msr' }],
      properties: [{
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      }, {
        enumOptions: [{ name: 'Canister', slug: 'canister' }],
        name: 'Fuel type',
        slug: 'fuel-type',
        unit: null
      }, {
        name: 'Piezo ignition',
        slug: 'piezo-ignition',
        unit: null
      }]
    })

    expect(result.map(({ label }) => label)).toStrictEqual([
      'Brand: MSR',
      'Weight: 80–100 g',
      'Fuel type: Canister',
      'Piezo ignition: Yes'
    ])
    expect(result).toHaveLength(getGearLibraryAppliedFilterCount(appliedFilters))
    expect(result[0]?.removeLabel).toBe('Remove Brand: MSR filter')
  })

  it('should keep malformed direct URL filters removable', () => {
    const result = createGearLibraryAppliedFilterChips({
      boolean: ['broken'],
      brand: [],
      enum: [],
      number: ['broken']
    }, {
      brands: [],
      properties: []
    })

    expect(result.map(({ label }) => label)).toStrictEqual([
      'Number: broken',
      'Boolean: broken'
    ])
  })
})
