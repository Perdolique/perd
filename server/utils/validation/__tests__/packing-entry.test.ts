import { ValiError } from 'valibot'
import { describe, expect, it } from 'vitest'
import { validatePackingListEntryUpdateBody } from '../schemas'

describe('packing entry updates', () => {
  it.each([1, 2_147_483_647])('accepts quantity boundary %s without requiring a packed flag', (quantity) => {
    expect(validatePackingListEntryUpdateBody({ quantity })).toStrictEqual({ quantity })
  })

  it.each([0, -1, 2_147_483_648, 1.5, '2', null, Infinity, Number.NaN])('rejects invalid quantity %s', (quantity) => {
    expect(() => validatePackingListEntryUpdateBody({ quantity })).toThrow(ValiError)
  })

  it.each(['-1', '-0.000000000000000001', '1e3', 'NaN', 'Infinity', '1,5', '', '1'.repeat(65), 2])('rejects invalid weight %s', (weightGrams) => {
    expect(() => validatePackingListEntryUpdateBody({ weightGrams })).toThrow(ValiError)
  })

  it.each([
    ['00012.345678901234567890000', '12.34567890123456789'],
    ['0', '0'],
    ['-0', '0'],
    ['1'.repeat(64), '1'.repeat(64)],
    [null, null]
  ])('preserves exact decimal weight or clears it: %s', (weightGrams, expected) => {
    expect(validatePackingListEntryUpdateBody({ weightGrams })).toStrictEqual({ weightGrams: expected })
  })

  it('accepts combined and packed-only changes, and rejects empty or unknown fields', () => {
    expect(validatePackingListEntryUpdateBody({ isPacked: false })).toStrictEqual({ isPacked: false })

    expect(validatePackingListEntryUpdateBody({
      isPacked: true,
      quantity: 3,
      weightGrams: '0.10'
    }))
      .toStrictEqual({
        isPacked: true,
        quantity: 3,
        weightGrams: '0.1'
      })

    expect(() => validatePackingListEntryUpdateBody({})).toThrow(ValiError)

    expect(() => validatePackingListEntryUpdateBody({
      quantity: 2,
      ownedQuantity: 3
    })).toThrow(ValiError)
  })
})
