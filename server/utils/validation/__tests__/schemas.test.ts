import { describe, expect, test } from 'vitest'
import { limits } from '#shared/constants'
import {
  validateBrandDetailParams,
  validateBrandIdParams,
  validateBrandMutationBody,
  validateBrandsListQuery,
  validateCategoryDetailParams,
  validateCategoryIdParams,
  validateCategoryMutationBody,
  validateGroupIdParams,
  validateGroupMutationBody,
  validateItemDetailParams,
  validateItemsListQuery,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody
} from '#server/utils/validation/schemas'

describe('validation schemas', () => {
  const maxBrandName = 'B'.repeat(limits.maxBrandNameLength)
  const maxBrandSlug = 's'.repeat(limits.maxBrandSlugLength)
  const tooLongBrandName = 'B'.repeat(limits.maxBrandNameLength + 1)
  const tooLongBrandSlug = 's'.repeat(limits.maxBrandSlugLength + 1)
  const maxCategoryName = 'C'.repeat(limits.maxEquipmentCategoryNameLength)
  const maxCategorySlug = 'c'.repeat(limits.maxEquipmentCategorySlugLength)
  const tooLongCategoryName = 'C'.repeat(limits.maxEquipmentCategoryNameLength + 1)
  const tooLongCategorySlug = 'c'.repeat(limits.maxEquipmentCategorySlugLength + 1)
  const maxGroupName = 'G'.repeat(limits.maxEquipmentGroupNameLength)
  const maxGroupSlug = 'g'.repeat(limits.maxEquipmentGroupSlugLength)
  const tooLongGroupName = 'G'.repeat(limits.maxEquipmentGroupNameLength + 1)
  const tooLongGroupSlug = 'g'.repeat(limits.maxEquipmentGroupSlugLength + 1)
  const validReferenceSlugs = [
    'sleep',
    'sleeping-bags',
    'bag-2'
  ]
  const invalidReferenceSlugs = [
    'Sleeping-Bags',
    'sleep bags',
    'sleep/bags',
    'sleep_bags',
    '-sleep',
    'sleep-',
    'sleep--bags'
  ]

  test('should convert numeric brand id params to number', () => {
    const result = validateBrandIdParams({
      id: '12'
    })

    expect(result).toStrictEqual({
      id: 12
    })
  })

  test.each([
    {},
    { id: '' },
    { id: '0' },
    { id: '01' },
    { id: 'msr' }
  ])('should reject invalid brand id params: %j', (params) => {
    expect(() => validateBrandIdParams(params)).toThrow()
  })

  test('should trim brand detail slug params', () => {
    const result = validateBrandDetailParams({
      slug: '  msr  '
    })

    expect(result).toStrictEqual({
      slug: 'msr'
    })
  })

  test.each(invalidReferenceSlugs)('should reject invalid brand detail slug params: %s', (slug) => {
    expect(() => validateBrandDetailParams({
      slug
    })).toThrow()
  })

  test('should trim brand mutation body fields', () => {
    const result = validateBrandMutationBody({
      name: '  MSR  ',
      slug: '  msr  '
    })

    expect(result).toStrictEqual({
      name: 'MSR',
      slug: 'msr'
    })
  })

  test.each([
    {
      name: '   ',
      slug: 'msr'
    },
    {
      name: 'MSR',
      slug: '   '
    }
  ])('should reject brand mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateBrandMutationBody(body)).toThrow()
  })

  test('should accept brand mutation body at max field lengths', () => {
    const result = validateBrandMutationBody({
      name: maxBrandName,
      slug: maxBrandSlug
    })

    expect(result).toStrictEqual({
      name: maxBrandName,
      slug: maxBrandSlug
    })
  })

  test.each([
    {
      name: tooLongBrandName,
      slug: 'msr'
    },
    {
      name: 'MSR',
      slug: tooLongBrandSlug
    }
  ])('should reject brand mutation body with oversized fields: %j', (body) => {
    expect(() => validateBrandMutationBody(body)).toThrow()
  })

  test.each(validReferenceSlugs)('should accept valid reference slugs in brand mutation body: %s', (slug) => {
    const result = validateBrandMutationBody({
      name: 'MSR',
      slug
    })

    expect(result).toStrictEqual({
      name: 'MSR',
      slug
    })
  })

  test.each(invalidReferenceSlugs)('should reject invalid brand mutation slug format: %s', (slug) => {
    expect(() => validateBrandMutationBody({
      name: 'MSR',
      slug
    })).toThrow()
  })

  test('should default and trim brand list query', () => {
    expect(validateBrandsListQuery({})).toStrictEqual({
      search: ''
    })

    expect(validateBrandsListQuery({
      search: '  msr  '
    })).toStrictEqual({
      search: 'msr'
    })
  })

  test('should convert numeric group id params to number', () => {
    const result = validateGroupIdParams({
      id: '7'
    })

    expect(result).toStrictEqual({
      id: 7
    })
  })

  test.each([
    {},
    { id: '' },
    { id: '0' },
    { id: '01' },
    { id: 'sleep' }
  ])('should reject invalid group id params: %j', (params) => {
    expect(() => validateGroupIdParams(params)).toThrow()
  })

  test('should trim group mutation body fields', () => {
    const result = validateGroupMutationBody({
      name: '  Sleep  ',
      slug: '  sleep  '
    })

    expect(result).toStrictEqual({
      name: 'Sleep',
      slug: 'sleep'
    })
  })

  test.each([
    {
      name: '   ',
      slug: 'sleep'
    },
    {
      name: 'Sleep',
      slug: '   '
    }
  ])('should reject group mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateGroupMutationBody(body)).toThrow()
  })

  test('should accept group mutation body at max field lengths', () => {
    const result = validateGroupMutationBody({
      name: maxGroupName,
      slug: maxGroupSlug
    })

    expect(result).toStrictEqual({
      name: maxGroupName,
      slug: maxGroupSlug
    })
  })

  test.each([
    {
      name: tooLongGroupName,
      slug: 'sleep'
    },
    {
      name: 'Sleep',
      slug: tooLongGroupSlug
    }
  ])('should reject group mutation body with oversized fields: %j', (body) => {
    expect(() => validateGroupMutationBody(body)).toThrow()
  })

  test.each(validReferenceSlugs)('should accept valid reference slugs in group mutation body: %s', (slug) => {
    const result = validateGroupMutationBody({
      name: 'Sleep',
      slug
    })

    expect(result).toStrictEqual({
      name: 'Sleep',
      slug
    })
  })

  test.each(invalidReferenceSlugs)('should reject invalid group mutation slug format: %s', (slug) => {
    expect(() => validateGroupMutationBody({
      name: 'Sleep',
      slug
    })).toThrow()
  })

  test('should convert numeric category id params to number', () => {
    const result = validateCategoryIdParams({
      id: '5'
    })

    expect(result).toStrictEqual({
      id: 5
    })
  })

  test.each([
    {},
    { id: '' },
    { id: '0' },
    { id: '01' },
    { id: 'sleeping-bags' }
  ])('should reject invalid category id params: %j', (params) => {
    expect(() => validateCategoryIdParams(params)).toThrow()
  })

  test('should trim category mutation body fields', () => {
    const result = validateCategoryMutationBody({
      name: '  Sleeping Bags  ',
      slug: '  sleeping-bags  '
    })

    expect(result).toStrictEqual({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })
  })

  test('should trim category detail slug params', () => {
    const result = validateCategoryDetailParams({
      slug: '  sleeping-bags  '
    })

    expect(result).toStrictEqual({
      slug: 'sleeping-bags'
    })
  })

  test.each(invalidReferenceSlugs)('should reject invalid category detail slug params: %s', (slug) => {
    expect(() => validateCategoryDetailParams({
      slug
    })).toThrow()
  })

  test.each([
    {
      name: '   ',
      slug: 'sleeping-bags'
    },
    {
      name: 'Sleeping Bags',
      slug: '   '
    }
  ])('should reject category mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateCategoryMutationBody(body)).toThrow()
  })

  test('should accept category mutation body at max field lengths', () => {
    const result = validateCategoryMutationBody({
      name: maxCategoryName,
      slug: maxCategorySlug
    })

    expect(result).toStrictEqual({
      name: maxCategoryName,
      slug: maxCategorySlug
    })
  })

  test.each([
    {
      name: tooLongCategoryName,
      slug: 'sleeping-bags'
    },
    {
      name: 'Sleeping Bags',
      slug: tooLongCategorySlug
    }
  ])('should reject category mutation body with oversized fields: %j', (body) => {
    expect(() => validateCategoryMutationBody(body)).toThrow()
  })

  test.each(validReferenceSlugs)('should accept valid reference slugs in category mutation body: %s', (slug) => {
    const result = validateCategoryMutationBody({
      name: 'Sleeping Bags',
      slug
    })

    expect(result).toStrictEqual({
      name: 'Sleeping Bags',
      slug
    })
  })

  test.each(invalidReferenceSlugs)('should reject invalid category mutation slug format: %s', (slug) => {
    expect(() => validateCategoryMutationBody({
      name: 'Sleeping Bags',
      slug
    })).toThrow()
  })

  test('should normalize items list query', () => {
    const result = validateItemsListQuery({
      brandSlug: '  msr  ',
      categorySlug: '  stoves  ',
      limit: '10',
      page: '2',
      search: '  pocket rocket  '
    })

    expect(result).toStrictEqual({
      brandSlug: 'msr',
      categorySlug: 'stoves',
      limit: 10,
      page: 2,
      search: 'pocket rocket'
    })
  })

  test('should apply default pagination and empty filters for items list query', () => {
    const result = validateItemsListQuery({})

    expect(result).toStrictEqual({
      limit: 20,
      page: 1,
      search: ''
    })
  })

  test.each([
    { page: 'abc' },
    { page: '0' },
    { limit: '0' },
    { limit: '101' },
    { page: ['1'] }
  ])('should reject malformed items list query: %j', (query) => {
    expect(() => validateItemsListQuery(query)).toThrow()
  })

  test('should accept canonical uuid v7 item ids only', () => {
    const result = validateItemDetailParams({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(result).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(() => validateItemDetailParams({
      id: '550e8400-e29b-41d4-a716-446655440000'
    })).toThrow()
  })

  test('should trim twitch oauth body and reject empty code', () => {
    expect(validateTwitchOAuthBody({
      code: '  oauth-code  '
    })).toStrictEqual({
      code: 'oauth-code'
    })

    expect(() => validateTwitchOAuthBody({
      code: '   '
    })).toThrow()
  })

  test('should sanitize redirect query targets', () => {
    expect(validateRedirectTargetQuery({
      redirectTo: '  /api/equipment/brands?search=msr  '
    })).toStrictEqual({
      redirectTo: '/api/equipment/brands?search=msr'
    })

    expect(validateRedirectTargetQuery({
      redirectTo: 'https://evil.example/path'
    })).toStrictEqual({
      redirectTo: '/'
    })

    expect(validateRedirectTargetQuery({})).toStrictEqual({
      redirectTo: '/'
    })
  })
})
