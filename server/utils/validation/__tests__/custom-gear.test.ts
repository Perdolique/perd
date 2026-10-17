import { describe, expect, it } from 'vitest'
import { validateUserEquipmentCreateBody, validateUserEquipmentUpdateBody } from '../schemas'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const tooLongName = 'a'.repeat(129)
const tooLongNote = 'a'.repeat(2001)
const tooLongWeight = '1'.repeat(65)

describe('custom gear input', () => {
  it.each([validateUserEquipmentCreateBody, validateUserEquipmentUpdateBody])('trims names, preserves case, and accepts the name boundary', (validate) => {
    const trimmed = validate({ customName: '  My DIY Stove  ' })

    expect(trimmed).toStrictEqual({ customName: 'My DIY Stove' })

    const customName = 'a'.repeat(128)
    const boundary = validate({ customName })

    expect(boundary).toStrictEqual({ customName })
  })

  it.each([
    {},
    { customName: '' },
    { customName: ' \t\n ' },
    { customName: tooLongName },
    { customName: null },
    { customName: 123 },
    {
      customName: 'Stove',
      itemId
    },
    {
      customName: 'Stove',
      quantity: 2
    }
  ])('rejects invalid or mixed custom input %j', (body) => {
    expect(() => validateUserEquipmentCreateBody(body)).toThrow(/./u)
    expect(() => validateUserEquipmentUpdateBody(body)).toThrow(/./u)
  })

  it('keeps catalog creation and rejects catalog rename bodies', () => {
    const result = validateUserEquipmentCreateBody({ itemId })

    expect(result).toStrictEqual({ itemId })
    expect(() => validateUserEquipmentUpdateBody({ itemId })).toThrow(/./u)
  })
})

describe('personal gear details', () => {
  it('normalizes personal names, notes, and exact decimal strings without losing precision', () => {
    const result = validateUserEquipmentUpdateBody({
      personalName: '  My stove  ',
      note: '  Without case\nKeep dry  ',
      measuredWeightGrams: ' +0018.123456789123456789000 ',
      ownedQuantity: 2
    })

    expect(result).toStrictEqual({
      personalName: 'My stove',
      note: 'Without case\nKeep dry',
      measuredWeightGrams: '18.123456789123456789',
      ownedQuantity: 2
    })
  })

  it('clears optional text and weight without treating a known zero as absent', () => {
    expect(validateUserEquipmentUpdateBody({
      personalName: '  ',
      note: '\n ',
      measuredWeightGrams: null
    })).toStrictEqual({
      personalName: null,
      note: null,
      measuredWeightGrams: null
    })

    expect(validateUserEquipmentUpdateBody({ measuredWeightGrams: '-0.000' })).toStrictEqual({ measuredWeightGrams: '0' })
    expect(validateUserEquipmentUpdateBody({ ownedQuantity: 2_147_483_647 })).toStrictEqual({ ownedQuantity: 2_147_483_647 })
  })

  it('accepts personal fields when creating private gear and leaves omitted defaults to storage', () => {
    expect(validateUserEquipmentCreateBody({
      customName: 'DIY',
      note: ' Mine ',
      measuredWeightGrams: '18.25',
      ownedQuantity: 2
    })).toStrictEqual({
      customName: 'DIY',
      note: 'Mine',
      measuredWeightGrams: '18.25',
      ownedQuantity: 2
    })

    expect(validateUserEquipmentCreateBody({ customName: 'DIY' })).toStrictEqual({ customName: 'DIY' })
  })

  it.each([
    {}, { note: undefined }, { personalName: tooLongName }, { note: tooLongNote },
    { measuredWeightGrams: '-0.01' }, { measuredWeightGrams: 'NaN' }, { measuredWeightGrams: 'Infinity' },
    { measuredWeightGrams: '1e3' }, { measuredWeightGrams: '' }, { measuredWeightGrams: 18.25 },
    { measuredWeightGrams: tooLongWeight }, { ownedQuantity: 0 }, { ownedQuantity: -1 },
    { ownedQuantity: 1.5 }, { ownedQuantity: '2' }, { ownedQuantity: 2_147_483_648 },
    {
      customName: 'DIY',
      personalName: null
    }, { userId: 'another-user' }, { itemId }
  ])('rejects invalid partial updates %j', (body) => {
    expect(() => validateUserEquipmentUpdateBody(body)).toThrow(/./u)
  })
})
