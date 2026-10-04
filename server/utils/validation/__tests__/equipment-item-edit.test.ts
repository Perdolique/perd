import { describe, expect, it } from 'vitest'
import { validateEquipmentItemUpdateBody } from '../schemas'

const body = {
  name: '  Updated item  ',
  brandId: 1,
  categoryId: 2,

  properties: [{
    propertyId: 3,
    value: '9007199254740993.125'
  }],

  expectedItemRevision: 0,
  expectedPropertiesRevision: 1,
  expectedOriginalPropertiesRevision: 2
}

describe('published item update input', () => {
  it('trims the name while retaining decimal strings and revision expectations', () => {
    const parsed = validateEquipmentItemUpdateBody(body)

    expect(parsed).toStrictEqual({
      ...body,
      name: 'Updated item',
      categoryChangeConfirmed: false
    })
  })

  it.each([
    { name: '' }, { name: ' '.repeat(10) }, { name: 'x'.repeat(257) },
    { expectedItemRevision: -1 }, { expectedItemRevision: 0.5 }, { expectedItemRevision: undefined },
    { expectedPropertiesRevision: undefined }, { expectedOriginalPropertiesRevision: undefined },
    { brandId: 0 }, { categoryId: '2' }, { categoryChangeConfirmed: 'true' },
    { properties: [{
      propertyId: 3,
      value: '1'
    }, {
      propertyId: 3,
      value: '2'
    }] },
    { properties: [{
      propertyId: 3,
      value: 12
    }] },
    { status: 'pending' }, { createdBy: 'someone' }, { sourceUrl: 'https://example.com' }, { decision: 'publish' }
  ])('rejects invalid or protected input %j', (replacement) => {
    expect(() => validateEquipmentItemUpdateBody({
      ...body,
      ...replacement
    })).toThrow(/.+/u)
  })

  it('accepts explicitly empty values and false without confusing them', () => {
    const emptyProperties = validateEquipmentItemUpdateBody({
      ...body,
      properties: []
    })

    expect(emptyProperties.properties).toStrictEqual([])

    const falseProperty = validateEquipmentItemUpdateBody({
      ...body,

      properties: [{
        propertyId: 1,
        value: false
      }]
    })

    expect(falseProperty.properties).toStrictEqual([{
      propertyId: 1,
      value: false
    }])
  })
})
