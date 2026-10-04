import { describe, expect, it } from 'vitest'
import { validateUserEquipmentCreateBody, validateUserEquipmentRenameBody } from '../schemas'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const tooLongName = 'a'.repeat(129)

describe('custom gear input', () => {
  it.each([validateUserEquipmentCreateBody, validateUserEquipmentRenameBody])('trims names, preserves case, and accepts the name boundary', (validate) => {
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
    expect(() => validateUserEquipmentRenameBody(body)).toThrow(/./u)
  })

  it('keeps catalog creation and rejects catalog rename bodies', () => {
    const result = validateUserEquipmentCreateBody({ itemId })

    expect(result).toStrictEqual({ itemId })
    expect(() => validateUserEquipmentRenameBody({ itemId })).toThrow(/./u)
  })
})
