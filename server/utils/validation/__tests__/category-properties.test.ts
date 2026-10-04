import { describe, expect, it } from 'vitest'

import {
  validateCategoryPropertiesOrderBody,
  validateCategoryPropertyDeleteQuery,
  validateCategoryPropertyMutationBody,
  validateCategoryPropertyUpdateBody,
  validateItemSubmissionCreateBody,
  validateItemSubmissionUpdateBody,
  validatePropertyEnumOptionRevisionMutationBody,
  validatePropertiesRevisionQuery
} from '#server/utils/validation/schemas'

const settings = {
  name: 'Weight',
  slug: 'weight',
  dataType: 'number',
  expectedPropertiesRevision: 0
}

describe('characteristics write contracts', () => {
  it.each([undefined, -1, 0.5, '0', null, 2_147_483_648])('rejects invalid or missing revision %j in admin write bodies', (revision) => {
    expect(() => validateCategoryPropertyMutationBody({
      ...settings,
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

  it.each([undefined, null, 0, '', '-1', '0.5', '1e2', '2147483648', ['0', '1']])('rejects invalid deletion query revision %j', (revision) => {
    expect(() => validatePropertiesRevisionQuery({ expectedPropertiesRevision: revision })).toThrow(/./u)

    expect(() => validateCategoryPropertyDeleteQuery({
      expectedPropertiesRevision: revision,
      expectedAffectedItemCount: '0'
    })).toThrow(/./u)
  })

  it.each([undefined, null, 0, '', '-1', '0.5', '1e2', ['0', '1']])('rejects invalid deletion query count %j', (count) => {
    expect(() => validateCategoryPropertyDeleteQuery({
      expectedPropertiesRevision: '0',
      expectedAffectedItemCount: count
    })).toThrow(/./u)
  })

  it('parses explicit deletion preconditions from URL query strings, including zero', () => {
    expect(validatePropertiesRevisionQuery({ expectedPropertiesRevision: '0' })).toStrictEqual({ expectedPropertiesRevision: 0 })

    expect(validateCategoryPropertyDeleteQuery({
      expectedPropertiesRevision: '2',
      expectedAffectedItemCount: '0'
    })).toStrictEqual({
      expectedPropertiesRevision: 2,
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
