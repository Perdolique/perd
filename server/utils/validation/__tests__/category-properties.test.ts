import { describe, expect, it } from 'vitest'

import {
  validateCategoryPropertiesOrderBody,
  validateCategoryPropertyDeleteBody,
  validateCategoryPropertyMutationBody,
  validateCategoryPropertyUpdateBody,
  validateItemSubmissionCreateBody,
  validateItemSubmissionUpdateBody,
  validatePropertyEnumOptionRevisionMutationBody
} from '#server/utils/validation/schemas'

const settings = {
  name: 'Weight',
  slug: 'weight',
  dataType: 'number',
  expectedPropertiesRevision: 0
}

describe('characteristics write contracts', () => {
  it.each([undefined, -1, 0.5, '0', null, 2_147_483_648])('rejects invalid or missing revision %j on every admin write', (revision) => {
    expect(() => validateCategoryPropertyMutationBody({
      ...settings,
      expectedPropertiesRevision: revision
    })).toThrow(/./u)

    expect(() => validateCategoryPropertyDeleteBody({
      expectedAffectedItemCount: 0,
      expectedPropertiesRevision: revision
    })).toThrow(/./u)

    expect(() => validateCategoryPropertiesOrderBody({
      propertyIds: [],
      expectedPropertiesRevision: revision
    })).toThrow(/./u)

    expect(() => validatePropertyEnumOptionRevisionMutationBody({
      name: 'Down',
      slug: 'down',
      expectedPropertiesRevision: revision
    })).toThrow(/./u)
  })

  it('requires an explicit nonnegative deletion count', () => {
    expect(() => validateCategoryPropertyDeleteBody({ expectedPropertiesRevision: 0 })).toThrow(/./u)

    expect(() => validateCategoryPropertyDeleteBody({
      expectedPropertiesRevision: 0,
      expectedAffectedItemCount: -1
    })).toThrow(/./u)

    expect(validateCategoryPropertyDeleteBody({
      expectedPropertiesRevision: 0,
      expectedAffectedItemCount: 0
    })).toStrictEqual({
      expectedPropertiesRevision: 0,
      expectedAffectedItemCount: 0
    })
  })

  it('accepts negative numbers only for number definitions and nullable units', () => {
    expect(validateCategoryPropertyUpdateBody({
      ...settings,
      unit: null,
      allowsNegativeValues: true
    })).toMatchObject({
      unit: null,
      allowsNegativeValues: true
    })

    expect(() => validateCategoryPropertyUpdateBody({
      ...settings,
      dataType: 'text',
      allowsNegativeValues: true
    })).toThrow(/./u)

    expect(() => validateCategoryPropertyUpdateBody({
      ...settings,
      dataType: 'boolean',
      unit: 'g'
    })).toThrow(/./u)
  })

  it('requires initial enum options for creation but keeps existing options out of an ordinary update', () => {
    const enumSettings = {
      ...settings,
      dataType: 'enum'
    }

    expect(() => validateCategoryPropertyMutationBody(enumSettings)).toThrow(/./u)
    expect(validateCategoryPropertyUpdateBody(enumSettings)).not.toHaveProperty('enumOptions')

    expect(() => validateCategoryPropertyMutationBody({
      ...enumSettings,

      enumOptions: [{
        name: 'Down',
        slug: 'down'
      }, {
        name: 'Other',
        slug: 'down'
      }]
    })).toThrow(/./u)
  })

  it('rejects duplicate order IDs', () => {
    expect(() => validateCategoryPropertiesOrderBody({
      propertyIds: [1, 1],
      expectedPropertiesRevision: 0
    })).toThrow(/./u)
  })

  it('keeps basic-only submissions but requires a version for values including false and zero', () => {
    const basic = {
      brandId: 1,
      categoryId: 2,
      name: 'Item',
      sourceUrl: 'https://example.com/item'
    }

    expect(validateItemSubmissionCreateBody(basic).properties).toStrictEqual([])

    for (const value of [false, '0']) {
      expect(() => validateItemSubmissionCreateBody({
        ...basic,

        properties: [{
          propertyId: 1,
          value
        }]
      })).toThrow(/./u)
    }

    expect(() => validateItemSubmissionUpdateBody({
      brandId: 1,
      categoryId: 2,
      name: 'Item',
      properties: [],
      expectedUpdatedAt: '2026-10-01T00:00:00.000Z',
      expectedPropertiesRevision: 0
    })).toThrow(/./u)
  })
})
