import { describe, expect, it } from 'vitest'
import { normalizeItemSubmissionProperties } from '../item-submission-properties'

const definitions = [{
  allowsNegativeValues: false,
  categoryId: 2,
  dataType: 'text',
  enumOptions: [],
  id: 1
}, {
  allowsNegativeValues: false,
  categoryId: 2,
  dataType: 'number',
  enumOptions: [],
  id: 2
}, {
  allowsNegativeValues: false,
  categoryId: 2,
  dataType: 'boolean',
  enumOptions: [],
  id: 3
}, {
  allowsNegativeValues: false,
  categoryId: 2,
  dataType: 'enum',
  enumOptions: [{ slug: 'canister' }, { slug: 'alcohol' }],
  id: 4
}]

describe('item submission properties', () => {
  it('should map every supported value to the correct EAV column', () => {
    const result = normalizeItemSubmissionProperties(2, definitions, [{
      propertyId: 1,
      value: '  Three season  '
    }, {
      propertyId: 2,
      value: '+0083.500'
    }, {
      propertyId: 3,
      value: false
    }, {
      propertyId: 4,
      value: 'canister'
    }])

    expect(result).toStrictEqual([{
      propertyId: 1,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'Three season'
    }, {
      propertyId: 2,
      valueBoolean: null,
      valueNumber: '83.5',
      valueText: null
    }, {
      propertyId: 3,
      valueBoolean: false,
      valueNumber: null,
      valueText: null
    }, {
      propertyId: 4,
      valueBoolean: null,
      valueNumber: null,
      valueText: 'canister'
    }])
  })

  it.each([
    {
      definitions,

      inputs: [{
        propertyId: 99,
        value: 'unknown'
      }],

      name: 'unknown property'
    },
    {
      definitions: [{
        allowsNegativeValues: false,
        categoryId: 3,
        dataType: 'text',
        enumOptions: [],
        id: 1
      }],

      inputs: [{
        propertyId: 1,
        value: 'wrong category'
      }],

      name: 'property from another category'
    },
    {
      definitions,

      inputs: [{
        propertyId: 1,
        value: '   '
      }],

      name: 'empty text'
    },
    {
      definitions,

      inputs: [{
        propertyId: 2,
        value: 'Infinity'
      }],

      name: 'invalid number'
    },
    {
      definitions,

      inputs: [{
        propertyId: 2,
        value: '-0.1'
      }],

      name: 'negative number without permission'
    },
    {
      definitions,

      inputs: [{
        propertyId: 2,
        value: true
      }],

      name: 'wrong number type'
    },
    {
      definitions,

      inputs: [{
        propertyId: 3,
        value: 'false'
      }],

      name: 'wrong boolean type'
    },
    {
      definitions,

      inputs: [{
        propertyId: 4,
        value: 'liquid'
      }],

      name: 'unknown enum option'
    }
  ])('should reject $name', ({ definitions: propertyDefinitions, inputs }) => {
    expect(() => normalizeItemSubmissionProperties(2, propertyDefinitions, inputs)).toThrow(
      expect.objectContaining({ statusCode: 400 })
    )
  })

  it('should allow negative values for properties that explicitly support them', () => {
    const temperatureDefinition = [{
      allowsNegativeValues: true,
      categoryId: 2,
      dataType: 'number',
      enumOptions: [],
      id: 5
    }]

    const result = normalizeItemSubmissionProperties(2, temperatureDefinition, [{
      propertyId: 5,
      value: '-10.5'
    }])

    expect(result).toStrictEqual([{
      propertyId: 5,
      valueBoolean: null,
      valueNumber: '-10.5',
      valueText: null
    }])
  })

  it('should treat an unsupported stored data type as a server error', () => {
    const unsupportedDefinitions = [{
      allowsNegativeValues: false,
      categoryId: 2,
      dataType: 'decimal',
      enumOptions: [],
      id: 1
    }]

    expect(() => normalizeItemSubmissionProperties(2, unsupportedDefinitions, [{
      propertyId: 1,
      value: '12'
    }])).toThrow(expect.objectContaining({ statusCode: 500 }))
  })
})
