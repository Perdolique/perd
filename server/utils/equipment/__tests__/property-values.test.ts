import { describe, expect, it } from 'vitest'
import {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue,
  type EquipmentPropertyDataType
} from '../property-values'

describe('equipment property values', () => {
  it.each([
    {
      expectedValue: true,
      input: { dataType: 'boolean', valueBoolean: true, valueNumber: null, valueText: null }
    },
    {
      expectedValue: null,
      input: { dataType: 'boolean', valueBoolean: null, valueNumber: null, valueText: null }
    },
    {
      expectedValue: 'canister',
      input: { dataType: 'enum', valueBoolean: null, valueNumber: null, valueText: 'canister' }
    },
    {
      expectedValue: 83.5,
      input: { dataType: 'number', valueBoolean: null, valueNumber: '83.5', valueText: null }
    },
    {
      expectedValue: null,
      input: { dataType: 'number', valueBoolean: null, valueNumber: null, valueText: null }
    },
    {
      expectedValue: 'three-season',
      input: { dataType: 'text', valueBoolean: null, valueNumber: null, valueText: 'three-season' }
    }
  ] as const)('should normalize a $input.dataType property value', ({ expectedValue, input }) => {
    const value = normalizeEquipmentPropertyValue(input)

    expect(value).toBe(expectedValue)
  })

  it.each<EquipmentPropertyDataType>([
    'boolean',
    'enum',
    'number',
    'text'
  ])('should accept the supported %s data type', (dataType) => {
    expect(getEquipmentPropertyDataType(dataType)).toBe(dataType)
  })

  it('should reject an unsupported database data type', () => {
    expect(() => getEquipmentPropertyDataType('decimal')).toThrow(expect.objectContaining({
      statusCode: 500
    }))
  })
})
