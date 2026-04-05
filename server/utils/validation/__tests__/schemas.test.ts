import { describe, expect, test } from 'vitest'
import {
  validateBrandDetailParams,
  validateBrandIdParams,
  validateBrandMutationBody,
  validateBrandsListQuery,
  validateItemDetailParams,
  validateItemsListQuery,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody
} from '#server/utils/validation/schemas'

describe('validation schemas', () => {
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
