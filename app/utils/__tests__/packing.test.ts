import { describe, expect, it } from 'vitest'
import type { PackingListEntry } from '../../types/packing'
import { calculatePackingListWeight, formatPackingListWeight, packingListCopyName } from '../packing'

describe('packing list weight', () => {
  it.each([{
    name: 'empty',
    entries: [],

    expected: {
      knownWeightGrams: '0',
      knownEntryCount: 0,
      unknownEntryCount: 0
    }
  }, {
    name: 'all unknown',

    entries: [{
      quantity: 8,
      weightGrams: null
    }, {
      quantity: 1,
      weightGrams: null
    }],

    expected: {
      knownWeightGrams: '0',
      knownEntryCount: 0,
      unknownEntryCount: 2
    }
  }, {
    name: 'partly known',

    entries: [{
      quantity: 3,
      weightGrams: '12.5'
    }, {
      quantity: 8,
      weightGrams: null
    }],

    expected: {
      knownWeightGrams: '37.5',
      knownEntryCount: 1,
      unknownEntryCount: 1
    }
  }, {
    name: 'fully known, including zero',

    entries: [{
      quantity: 8,
      weightGrams: '0'
    }, {
      quantity: 3,
      weightGrams: '12.5'
    }],

    expected: {
      knownWeightGrams: '37.5',
      knownEntryCount: 2,
      unknownEntryCount: 0
    }
  }])('distinguishes $name measurements and counts unknown rows rather than quantities', ({ entries, expected }) => {
    const result = calculatePackingListWeight(entries)

    expect(result).toStrictEqual(expected)
  })

  it('includes resolved catalog, measured, and custom weights regardless of packed marks', () => {
    const entries = [{
      source: 'inventory',
      weightSource: 'catalog',
      weightGrams: '100',
      quantity: 2,
      isPacked: false
    }, {
      source: 'inventory',
      weightSource: 'measured',
      weightGrams: '0',
      quantity: 3,
      isPacked: true
    }, {
      source: 'custom',
      weightSource: 'custom',
      weightGrams: '0.1',
      quantity: 3,
      isPacked: true
    }] satisfies Pick<PackingListEntry, 'source' | 'weightSource' | 'weightGrams' | 'quantity' | 'isPacked'>[]

    const result = calculatePackingListWeight(entries)

    expect(result).toStrictEqual({
      knownWeightGrams: '200.3',
      knownEntryCount: 3,
      unknownEntryCount: 0
    })
  })

  it.each([
    [[{
      quantity: 3,
      weightGrams: '123.456789012345678901'
    }, {
      quantity: 2,
      weightGrams: '0.000000000000000099'
    }], '370.370367037037036901'],
    [[{
      quantity: 2,
      weightGrams: '9007199254740993.0001'
    }], '18014398509481986.0002'],
    [[{
      quantity: 2_147_483_647,
      weightGrams: '0.1'
    }], '214748364.7'],
    [[{
      quantity: 2,
      weightGrams: '1.2'
    }, {
      quantity: 1,
      weightGrams: '0.00001'
    }, {
      quantity: 3,
      weightGrams: '10'
    }], '32.40001'],
    [[{
      quantity: 1,
      weightGrams: '0.00001'
    }, {
      quantity: 3,
      weightGrams: '10'
    }, {
      quantity: 2,
      weightGrams: '1.2'
    }], '32.40001']
  ])('preserves exact products and sums: %j', (entries, expected) => {
    const result = calculatePackingListWeight(entries)

    expect(result.knownWeightGrams).toBe(expected)
  })

  it('rounds only the completed sum, including individually sub-milligram inputs', () => {
    const result = calculatePackingListWeight([{
      quantity: 3,
      weightGrams: '0.0004'
    }])

    const formatted = formatPackingListWeight(result.knownWeightGrams)

    expect(result.knownWeightGrams).toBe('0.0012')
    expect(formatted).toBe('0.001 g')
  })
})

describe('packing list weight display', () => {
  it.each([
    ['0', '0 g'],
    ['0.00000000000000000001', '<0.001 g'],
    ['0.0009', '<0.001 g'],
    ['0.001', '0.001 g'],
    ['12.3454', '12.345 g'],
    ['12.3455', '12.346 g'],
    ['120.5000', '120.5 g'],
    ['999.9994', '999.999 g'],
    ['999.9995', '1000 g'],
    ['1000', '1 kg'],
    ['1234.5', '1.235 kg'],
    ['1000.4999999999999999', '1 kg'],
    ['1000.5', '1.001 kg'],
    ['9007199254740993500', '9007199254740993.5 kg'],
    ['999999999999999999999.999', '1000000000000000000 kg']
  ])('formats %s grams as %s without losing precision before rounding', (weight, expected) => {
    const result = formatPackingListWeight(weight)

    expect(result).toBe(expected)
  })
})

describe('packing list copy name', () => {
  const maximumName = 'A'.repeat(128)
  const truncatedName = 'A'.repeat(121)
  const truncatedCopyName = `${truncatedName} — copy`
  const unicodePrefix = 'A'.repeat(120)
  const unicodeBoundaryName = `${unicodePrefix}🎒Long`
  const unicodeBoundaryCopyName = `${unicodePrefix} — copy`
  const maximumUnicodeName = '🎒'.repeat(64)
  const truncatedUnicodeName = '🎒'.repeat(60)
  const truncatedUnicodeCopyName = `${truncatedUnicodeName} — copy`

  it.each([
    ['Trip', 'Trip — copy'],
    [maximumName, truncatedCopyName],
    [unicodeBoundaryName, unicodeBoundaryCopyName],
    [maximumUnicodeName, truncatedUnicodeCopyName]
  ])('keeps the suffix within 128 UTF-16 units without splitting Unicode: %s', (name, expected) => {
    const result = packingListCopyName(name)

    expect(result).toBe(expected)
    expect(result.length).toBeLessThanOrEqual(128)
    expect(result.isWellFormed()).toBe(true)
  })
})
