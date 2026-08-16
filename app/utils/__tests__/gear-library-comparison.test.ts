import { describe, expect, it } from 'vitest'
import type { ComparisonResponse } from '#server/api/equipment/comparisons.get'

import {
  areGearLibraryComparisonValuesEqual,
  createGearLibraryComparisonRows,
  formatGearLibraryComparisonValue,
  validateGearLibraryComparisonQuery
} from '~/utils/gear-library-comparison'

const firstItemId = '01980000-0000-7000-8000-000000000001'
const secondItemId = '01980000-0000-7000-8000-00000000000a'
const thirdItemId = '01980000-0000-7000-8000-000000000003'
const fourthItemId = '01980000-0000-7000-8000-000000000004'
const fifthItemId = '01980000-0000-7000-8000-000000000005'

const comparisonProperties: ComparisonResponse['properties'] = [
  {
    dataType: 'number',
    id: 1,
    name: 'Weight',
    slug: 'weight',
    unit: 'g',
    values: [
      { itemId: firstItemId, value: 500 },
      { itemId: secondItemId, value: 500 },
      { itemId: thirdItemId, value: null }
    ]
  },
  {
    dataType: 'enum',
    id: 2,
    name: 'Season',
    slug: 'season',
    unit: null,
    values: [
      { enumOptionName: 'Three season', itemId: firstItemId, value: 'three-season' },
      { enumOptionName: 'Three season', itemId: secondItemId, value: 'three-season' },
      { enumOptionName: 'Four season', itemId: thirdItemId, value: 'four-season' }
    ]
  }
]

describe(validateGearLibraryComparisonQuery, () => {
  it.each([
    [undefined, true, false],
    [firstItemId, true, false],
    [[firstItemId, secondItemId], false, true],
    [[firstItemId, secondItemId, thirdItemId, fourthItemId], false, true],
    [[firstItemId, secondItemId, thirdItemId, fourthItemId, fifthItemId], false, false]
  ])('validates item count for %j', (value, hasInsufficientIds, isValid) => {
    const result = validateGearLibraryComparisonQuery(value)

    expect(result.hasInsufficientIds).toBe(hasInsufficientIds)
    expect(result.isValid).toBe(isValid)
  })

  it('reports malformed, uppercase, null, duplicate, and over-limit values together', () => {
    const result = validateGearLibraryComparisonQuery([
      firstItemId,
      firstItemId,
      secondItemId.toUpperCase(),
      null,
      thirdItemId
    ])

    expect(result).toStrictEqual({
      ids: [firstItemId, firstItemId, thirdItemId],
      hasDuplicateIds: true,
      hasInsufficientIds: false,
      hasInvalidIds: true,
      hasOverLimitIds: true,
      isValid: false
    })
  })

  it('preserves valid URL order', () => {
    const result = validateGearLibraryComparisonQuery([thirdItemId, firstItemId, secondItemId])

    expect(result.ids).toStrictEqual([thirdItemId, firstItemId, secondItemId])
  })
})

describe('comparison values', () => {
  it.each([
    [[null, null], true],
    [[null, 0], false],
    [[true, true], true],
    [[1, 1], true],
    [['three-season', 'three-season'], true],
    [['1', 1], false]
  ])('compares raw values %j', (values, expected) => {
    expect(areGearLibraryComparisonValuesEqual(values)).toBe(expected)
  })

  it('formats null, booleans, numbers, enums, and text', () => {
    expect(formatGearLibraryComparisonValue(
      { dataType: 'text', unit: null },
      { itemId: firstItemId, value: null }
    )).toBe('—')

    expect(formatGearLibraryComparisonValue(
      { dataType: 'boolean', unit: null },
      { itemId: firstItemId, value: true }
    )).toBe('Yes')

    expect(formatGearLibraryComparisonValue(
      { dataType: 'number', unit: 'g' },
      { itemId: firstItemId, value: 500 }
    )).toBe('500 g')

    expect(formatGearLibraryComparisonValue(
      { dataType: 'enum', unit: null },
      { enumOptionName: 'Three season', itemId: firstItemId, value: 'three-season' }
    )).toBe('Three season')

    expect(formatGearLibraryComparisonValue(
      { dataType: 'enum', unit: null },
      { itemId: firstItemId, value: 'three-season' }
    )).toBe('three-season')

    expect(formatGearLibraryComparisonValue(
      { dataType: 'text', unit: null },
      { itemId: firstItemId, value: 'Dyneema' }
    )).toBe('Dyneema')
  })
})

describe(createGearLibraryComparisonRows, () => {
  it('keeps category order and projects the requested selected items', () => {
    const rows = createGearLibraryComparisonRows(
      comparisonProperties,
      [thirdItemId, firstItemId],
      false
    )

    expect(rows.map((row) => row.slug)).toStrictEqual(['weight', 'season'])
    expect(rows[0]?.values).toStrictEqual([
      { displayValue: '—', itemId: thirdItemId, rawValue: null },
      { displayValue: '500 g', itemId: firstItemId, rawValue: 500 }
    ])
  })

  it('filters by all visible desktop columns', () => {
    const rows = createGearLibraryComparisonRows(
      comparisonProperties,
      [firstItemId, secondItemId, thirdItemId],
      true
    )

    expect(rows.map((row) => row.slug)).toStrictEqual(['weight', 'season'])
  })

  it('returns an empty state when every selected item has the same value', () => {
    const rows = createGearLibraryComparisonRows(
      comparisonProperties,
      [firstItemId, secondItemId],
      true
    )

    expect(rows).toStrictEqual([])
  })
})
