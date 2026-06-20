import { describe, expect, it } from 'vitest'
import { limits } from '#shared/constants'
import {
  validateBrandDetailParams,
  validateBrandIdParams,
  validateBrandMutationBody,
  validateBrandsListQuery,
  validateCategoryDetailParams,
  validateCategoryIdParams,
  validateCategoryMutationBody,
  validateCategoryPropertyMutationBody,
  validateCategoryPropertyParams,
  validateCategoryScopedParams,
  validateGroupIdParams,
  validateGroupMutationBody,
  validateItemDetailParams,
  validateItemSubmissionCreateBody,
  validateItemSubmissionModerationBody,
  validateItemsListQuery,
  validatePackingListEntryCreateBody,
  validatePackingListEntryParams,
  validatePackingListEntryUpdateBody,
  validatePackingListIdParams,
  validatePackingListMutationBody,
  validatePropertyEnumOptionMutationBody,
  validatePropertyEnumOptionParams,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody,
  validateUserEquipmentCreateBody,
  validateUserEquipmentIdParams
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
  const maxCategoryPropertyName = 'P'.repeat(limits.maxCategoryPropertyNameLength)
  const maxCategoryPropertySlug = 'p'.repeat(limits.maxCategoryPropertySlugLength)
  const maxCategoryPropertyUnit = 'u'.repeat(limits.maxCategoryPropertyUnitLength)
  const tooLongCategoryPropertyName = 'P'.repeat(limits.maxCategoryPropertyNameLength + 1)
  const tooLongCategoryPropertySlug = 'p'.repeat(limits.maxCategoryPropertySlugLength + 1)
  const tooLongCategoryPropertyUnit = 'u'.repeat(limits.maxCategoryPropertyUnitLength + 1)
  const maxGroupName = 'G'.repeat(limits.maxEquipmentGroupNameLength)
  const maxGroupSlug = 'g'.repeat(limits.maxEquipmentGroupSlugLength)
  const tooLongGroupName = 'G'.repeat(limits.maxEquipmentGroupNameLength + 1)
  const tooLongGroupSlug = 'g'.repeat(limits.maxEquipmentGroupSlugLength + 1)
  const maxEquipmentItemName = 'I'.repeat(limits.maxEquipmentItemNameLength)
  const tooLongEquipmentItemName = 'I'.repeat(limits.maxEquipmentItemNameLength + 1)
  const maxPackingListName = 'P'.repeat(limits.maxPackingListNameLength)
  const tooLongPackingListName = 'P'.repeat(limits.maxPackingListNameLength + 1)
  const maxPackingListEntryCustomName = 'E'.repeat(limits.maxPackingListEntryCustomNameLength)
  const tooLongPackingListEntryCustomName = 'E'.repeat(limits.maxPackingListEntryCustomNameLength + 1)
  const maxPropertyEnumOptionName = 'O'.repeat(limits.maxPropertyEnumOptionNameLength)
  const maxPropertyEnumOptionSlug = 'o'.repeat(limits.maxPropertyEnumOptionSlugLength)
  const tooLongPropertyEnumOptionName = 'O'.repeat(limits.maxPropertyEnumOptionNameLength + 1)
  const tooLongPropertyEnumOptionSlug = 'o'.repeat(limits.maxPropertyEnumOptionSlugLength + 1)
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

  it('should convert numeric brand id params to number', () => {
    const result = validateBrandIdParams({
      id: '12'
    })

    expect(result).toStrictEqual({
      id: 12
    })
  })

  it.each([{}, { id: '' }, { id: '0' }, { id: '01' }, { id: 'msr' }])('should reject invalid brand id params: %j', (params) => {
    expect(() => validateBrandIdParams(params)).toThrow(/./u)
  })

  it('should trim brand detail slug params', () => {
    const result = validateBrandDetailParams({
      slug: '  msr  '
    })

    expect(result).toStrictEqual({
      slug: 'msr'
    })
  })

  it.each(invalidReferenceSlugs)('should reject invalid brand detail slug params: %s', (slug) => {
    expect(() => validateBrandDetailParams({
      slug
    })).toThrow(/./u)
  })

  it('should trim brand mutation body fields', () => {
    const result = validateBrandMutationBody({
      name: '  MSR  ',
      slug: '  msr  '
    })

    expect(result).toStrictEqual({
      name: 'MSR',
      slug: 'msr'
    })
  })

  it.each([{
    name: '   ',
    slug: 'msr'
  }, {
    name: 'MSR',
    slug: '   '
  }])('should reject brand mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateBrandMutationBody(body)).toThrow(/./u)
  })

  it('should accept brand mutation body at max field lengths', () => {
    const result = validateBrandMutationBody({
      name: maxBrandName,
      slug: maxBrandSlug
    })

    expect(result).toStrictEqual({
      name: maxBrandName,
      slug: maxBrandSlug
    })
  })

  it.each([{
    name: tooLongBrandName,
    slug: 'msr'
  }, {
    name: 'MSR',
    slug: tooLongBrandSlug
  }])('should reject brand mutation body with oversized fields: %j', (body) => {
    expect(() => validateBrandMutationBody(body)).toThrow(/./u)
  })

  it.each(validReferenceSlugs)('should accept valid reference slugs in brand mutation body: %s', (slug) => {
    const result = validateBrandMutationBody({
      name: 'MSR',
      slug
    })

    expect(result).toStrictEqual({
      name: 'MSR',
      slug
    })
  })

  it.each(invalidReferenceSlugs)('should reject invalid brand mutation slug format: %s', (slug) => {
    expect(() => validateBrandMutationBody({
      name: 'MSR',
      slug
    })).toThrow(/./u)
  })

  it('should default and trim brand list query', () => {
    expect(validateBrandsListQuery({})).toStrictEqual({
      search: ''
    })

    expect(validateBrandsListQuery({
      search: '  msr  '
    })).toStrictEqual({
      search: 'msr'
    })
  })

  it('should convert numeric group id params to number', () => {
    const result = validateGroupIdParams({
      id: '7'
    })

    expect(result).toStrictEqual({
      id: 7
    })
  })

  it.each([{}, { id: '' }, { id: '0' }, { id: '01' }, { id: 'sleep' }])('should reject invalid group id params: %j', (params) => {
    expect(() => validateGroupIdParams(params)).toThrow(/./u)
  })

  it('should validate packing list id params', () => {
    const result = validatePackingListIdParams({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(result).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  it.each([{}, { id: '' }, { id: '0195f6e8-8f44-64f6-bc9a-5c8f7df477d7' }, { id: 'packing-list' }])(
    'should reject invalid packing list id params: %j',
    (params) => {
      expect(() => validatePackingListIdParams(params)).toThrow(/./u)
    }
  )

  it('should validate packing list entry params', () => {
    const camelCaseResult = validatePackingListEntryParams({
      entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
    const kebabCaseResult = validatePackingListEntryParams({
      'entry-id': '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(camelCaseResult).toStrictEqual({
      entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
    expect(kebabCaseResult).toStrictEqual({
      entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  it.each([
    {},
    { entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8' },
    { id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7' },
    {
      entryId: 'packing-entry',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    }
  ])('should reject invalid packing list entry params: %j', (params) => {
    expect(() => validatePackingListEntryParams(params)).toThrow(/./u)
  })

  it('should trim packing list mutation body name', () => {
    const result = validatePackingListMutationBody({
      name: '  Alpine weekend  '
    })

    expect(result).toStrictEqual({
      name: 'Alpine weekend'
    })
  })

  it('should accept packing list mutation body at max name length', () => {
    const result = validatePackingListMutationBody({
      name: maxPackingListName
    })

    expect(result).toStrictEqual({
      name: maxPackingListName
    })
  })

  it.each([{
    name: '   '
  }, {
    name: tooLongPackingListName
  }])('should reject invalid packing list mutation body: %j', (body) => {
    expect(() => validatePackingListMutationBody(body)).toThrow(/./u)
  })

  it('should trim packing list entry custom name', () => {
    const result = validatePackingListEntryCreateBody({
      customName: '  Rain jacket  '
    })

    expect(result).toStrictEqual({
      customName: 'Rain jacket'
    })
  })

  it('should accept packing list entry custom name at max length', () => {
    const result = validatePackingListEntryCreateBody({
      customName: maxPackingListEntryCustomName
    })

    expect(result).toStrictEqual({
      customName: maxPackingListEntryCustomName
    })
  })

  it('should accept packing list entry inventory id', () => {
    const result = validatePackingListEntryCreateBody({
      inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
    })

    expect(result).toStrictEqual({
      inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
    })
  })

  it.each([{
    customName: 'Rain jacket',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
  }, {
    inventoryId: 'packing-entry'
  }, {
    customName: '   '
  }, {
    customName: tooLongPackingListEntryCustomName
  }, {
    customName: undefined,
    inventoryId: undefined
  }])('should reject invalid packing list entry create body: %j', (body) => {
    expect(() => validatePackingListEntryCreateBody(body)).toThrow(/./u)
  })

  it.each([true, false])('should accept packing list entry packed state: %s', (isPacked) => {
    const result = validatePackingListEntryUpdateBody({
      isPacked
    })

    expect(result).toStrictEqual({
      isPacked
    })
  })

  it.each([{}, { isPacked: 'true' }, { isPacked: 1 }, { isPacked: null }])(
    'should reject invalid packing list entry update body: %j',
    (body) => {
      expect(() => validatePackingListEntryUpdateBody(body)).toThrow(/./u)
    }
  )

  it('should trim group mutation body fields', () => {
    const result = validateGroupMutationBody({
      name: '  Sleep  ',
      slug: '  sleep  '
    })

    expect(result).toStrictEqual({
      name: 'Sleep',
      slug: 'sleep'
    })
  })

  it.each([{
    name: '   ',
    slug: 'sleep'
  }, {
    name: 'Sleep',
    slug: '   '
  }])('should reject group mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateGroupMutationBody(body)).toThrow(/./u)
  })

  it('should accept group mutation body at max field lengths', () => {
    const result = validateGroupMutationBody({
      name: maxGroupName,
      slug: maxGroupSlug
    })

    expect(result).toStrictEqual({
      name: maxGroupName,
      slug: maxGroupSlug
    })
  })

  it.each([{
    name: tooLongGroupName,
    slug: 'sleep'
  }, {
    name: 'Sleep',
    slug: tooLongGroupSlug
  }])('should reject group mutation body with oversized fields: %j', (body) => {
    expect(() => validateGroupMutationBody(body)).toThrow(/./u)
  })

  it.each(validReferenceSlugs)('should accept valid reference slugs in group mutation body: %s', (slug) => {
    const result = validateGroupMutationBody({
      name: 'Sleep',
      slug
    })

    expect(result).toStrictEqual({
      name: 'Sleep',
      slug
    })
  })

  it.each(invalidReferenceSlugs)('should reject invalid group mutation slug format: %s', (slug) => {
    expect(() => validateGroupMutationBody({
      name: 'Sleep',
      slug
    })).toThrow(/./u)
  })

  it('should convert numeric category id params to number', () => {
    const result = validateCategoryIdParams({
      id: '5'
    })

    expect(result).toStrictEqual({
      id: 5
    })
  })

  it.each([{}, { id: '' }, { id: '0' }, { id: '01' }, { id: 'sleeping-bags' }])('should reject invalid category id params: %j', (params) => {
    expect(() => validateCategoryIdParams(params)).toThrow(/./u)
  })

  it('should convert nested category id params to number', () => {
    const result = validateCategoryScopedParams({
      categoryId: '5'
    })

    expect(result).toStrictEqual({
      categoryId: 5
    })
  })

  it.each([{}, { categoryId: '' }, { categoryId: '0' }, { categoryId: '01' }, { categoryId: 'sleeping-bags' }])('should reject invalid nested category id params: %j', (params) => {
    expect(() => validateCategoryScopedParams(params)).toThrow(/./u)
  })

  it('should trim category mutation body fields', () => {
    const result = validateCategoryMutationBody({
      name: '  Sleeping Bags  ',
      slug: '  sleeping-bags  '
    })

    expect(result).toStrictEqual({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })
  })

  it('should trim category detail slug params', () => {
    const result = validateCategoryDetailParams({
      slug: '  sleeping-bags  '
    })

    expect(result).toStrictEqual({
      slug: 'sleeping-bags'
    })
  })

  it.each(invalidReferenceSlugs)('should reject invalid category detail slug params: %s', (slug) => {
    expect(() => validateCategoryDetailParams({
      slug
    })).toThrow(/./u)
  })

  it.each([{
    name: '   ',
    slug: 'sleeping-bags'
  }, {
    name: 'Sleeping Bags',
    slug: '   '
  }])('should reject category mutation body with empty trimmed fields: %j', (body) => {
    expect(() => validateCategoryMutationBody(body)).toThrow(/./u)
  })

  it('should accept category mutation body at max field lengths', () => {
    const result = validateCategoryMutationBody({
      name: maxCategoryName,
      slug: maxCategorySlug
    })

    expect(result).toStrictEqual({
      name: maxCategoryName,
      slug: maxCategorySlug
    })
  })

  it.each([{
    name: tooLongCategoryName,
    slug: 'sleeping-bags'
  }, {
    name: 'Sleeping Bags',
    slug: tooLongCategorySlug
  }])('should reject category mutation body with oversized fields: %j', (body) => {
    expect(() => validateCategoryMutationBody(body)).toThrow(/./u)
  })

  it.each(validReferenceSlugs)('should accept valid reference slugs in category mutation body: %s', (slug) => {
    const result = validateCategoryMutationBody({
      name: 'Sleeping Bags',
      slug
    })

    expect(result).toStrictEqual({
      name: 'Sleeping Bags',
      slug
    })
  })

  it.each(invalidReferenceSlugs)('should reject invalid category mutation slug format: %s', (slug) => {
    expect(() => validateCategoryMutationBody({
      name: 'Sleeping Bags',
      slug
    })).toThrow(/./u)
  })

  it('should convert numeric category property params to numbers', () => {
    const result = validateCategoryPropertyParams({
      categoryId: '5',
      propertyId: '11'
    })

    expect(result).toStrictEqual({
      categoryId: 5,
      propertyId: 11
    })
  })

  it.each([{}, { categoryId: '5' }, { categoryId: '0', propertyId: '11' }, { categoryId: '5', propertyId: '01' }])('should reject invalid category property params: %j', (params) => {
    expect(() => validateCategoryPropertyParams(params)).toThrow(/./u)
  })

  it('should convert numeric property enum option params to numbers', () => {
    const result = validatePropertyEnumOptionParams({
      categoryId: '5',
      optionId: '21',
      propertyId: '11'
    })

    expect(result).toStrictEqual({
      categoryId: 5,
      optionId: 21,
      propertyId: 11
    })
  })

  it.each([{}, { categoryId: '5', propertyId: '11' }, { categoryId: 'x', optionId: '21', propertyId: '11' }, { categoryId: '5', optionId: '00', propertyId: '11' }])('should reject invalid property enum option params: %j', (params) => {
    expect(() => validatePropertyEnumOptionParams(params)).toThrow(/./u)
  })

  it('should trim and validate number category property bodies', () => {
    const result = validateCategoryPropertyMutationBody({
      dataType: 'number',
      name: '  Weight  ',
      slug: '  weight  ',
      unit: '  g  '
    })

    expect(result).toStrictEqual({
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    })
  })

  it('should trim and validate enum category property bodies with options', () => {
    const result = validateCategoryPropertyMutationBody({
      dataType: 'enum',

      enumOptions: [{
        name: '  Down  ',
        slug: '  down  '
      }, {
        name: 'Synthetic',
        slug: 'synthetic'
      }],

      name: '  Fill Type  ',
      slug: '  fill-type  '
    })

    expect(result).toStrictEqual({
      dataType: 'enum',

      enumOptions: [{
        name: 'Down',
        slug: 'down'
      }, {
        name: 'Synthetic',
        slug: 'synthetic'
      }],

      name: 'Fill Type',
      slug: 'fill-type'
    })
  })

  it('should accept category property body at max field lengths', () => {
    const result = validateCategoryPropertyMutationBody({
      dataType: 'number',
      name: maxCategoryPropertyName,
      slug: maxCategoryPropertySlug,
      unit: maxCategoryPropertyUnit
    })

    expect(result).toStrictEqual({
      dataType: 'number',
      name: maxCategoryPropertyName,
      slug: maxCategoryPropertySlug,
      unit: maxCategoryPropertyUnit
    })
  })

  it.each([{
    dataType: 'number',
    name: tooLongCategoryPropertyName,
    slug: 'weight'
  }, {
    dataType: 'number',
    name: 'Weight',
    slug: tooLongCategoryPropertySlug
  }, {
    dataType: 'number',
    name: 'Weight',
    slug: 'weight',
    unit: tooLongCategoryPropertyUnit
  }])('should reject oversized category property body fields: %j', (body) => {
    expect(() => validateCategoryPropertyMutationBody(body)).toThrow(/./u)
  })

  it.each([{
    dataType: 'enum',
    name: 'Fill Type',
    slug: 'fill-type'
  }, {
    dataType: 'boolean',
    enumOptions: [{
      name: 'Yes',
      slug: 'yes'
    }],
    name: 'Freestanding',
    slug: 'freestanding'
  }, {
    dataType: 'text',
    name: 'Notes',
    slug: 'notes',
    unit: 'g'
  }, {
    dataType: 'enum',

    enumOptions: [{
      name: 'Down',
      slug: 'down'
    }, {
      name: 'Duplicate Down',
      slug: 'down'
    }],

    name: 'Fill Type',
    slug: 'fill-type'
  }])('should reject invalid category property body combinations: %j', (body) => {
    expect(() => validateCategoryPropertyMutationBody(body)).toThrow(/./u)
  })

  it('should trim property enum option mutation body fields', () => {
    const result = validatePropertyEnumOptionMutationBody({
      name: '  Down  ',
      slug: '  down  '
    })

    expect(result).toStrictEqual({
      name: 'Down',
      slug: 'down'
    })
  })

  it('should accept property enum option mutation body at max field lengths', () => {
    const result = validatePropertyEnumOptionMutationBody({
      name: maxPropertyEnumOptionName,
      slug: maxPropertyEnumOptionSlug
    })

    expect(result).toStrictEqual({
      name: maxPropertyEnumOptionName,
      slug: maxPropertyEnumOptionSlug
    })
  })

  it.each([{
    name: '   ',
    slug: 'down'
  }, {
    name: 'Down',
    slug: '   '
  }, {
    name: tooLongPropertyEnumOptionName,
    slug: 'down'
  }, {
    name: 'Down',
    slug: tooLongPropertyEnumOptionSlug
  }])('should reject invalid property enum option mutation body: %j', (body) => {
    expect(() => validatePropertyEnumOptionMutationBody(body)).toThrow(/./u)
  })

  it('should normalize items list query', () => {
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

  it('should apply default pagination and empty filters for items list query', () => {
    const result = validateItemsListQuery({})

    expect(result).toStrictEqual({
      limit: 20,
      page: 1,
      search: ''
    })
  })

  it('should clamp too-large items list limits to the shared maximum', () => {
    const result = validateItemsListQuery({
      limit: '101'
    })

    expect(result).toStrictEqual({
      limit: 100,
      page: 1,
      search: ''
    })
  })

  it.each([{ page: 'abc' }, { page: '0' }, { limit: '0' }, { page: ['1'] }])('should reject malformed items list query: %j', (query) => {
    expect(() => validateItemsListQuery(query)).toThrow(/./u)
  })

  it('should accept canonical uuid v7 item ids only', () => {
    const result = validateItemDetailParams({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(result).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(() => validateItemDetailParams({
      id: '550e8400-e29b-41d4-a716-446655440000'
    })).toThrow(/./u)
  })

  it('should trim and validate item submission create bodies', () => {
    const result = validateItemSubmissionCreateBody({
      brandId: 1,
      categoryId: 2,
      name: '  PocketRocket Deluxe  ',

      properties: [{
        propertyId: 10,
        value: ' 83 '
      }, {
        propertyId: 11,
        value: false
      }]
    })

    expect(result).toStrictEqual({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',

      properties: [{
        propertyId: 10,
        value: '83'
      }, {
        propertyId: 11,
        value: false
      }]
    })
  })

  it('should default item submission properties to an empty array', () => {
    const result = validateItemSubmissionCreateBody({
      brandId: 1,
      categoryId: 2,
      name: maxEquipmentItemName
    })

    expect(result).toStrictEqual({
      brandId: 1,
      categoryId: 2,
      name: maxEquipmentItemName,
      properties: []
    })
  })

  it.each([{
    brandId: 0,
    categoryId: 2,
    name: 'PocketRocket Deluxe'
  }, {
    brandId: 1,
    categoryId: '2',
    name: 'PocketRocket Deluxe'
  }, {
    brandId: 1,
    categoryId: 2,
    name: '   '
  }, {
    brandId: 1,
    categoryId: 2,
    name: tooLongEquipmentItemName
  }, {
    brandId: 1,
    categoryId: 2,
    name: 'PocketRocket Deluxe',

    properties: [{
      propertyId: 10,
      value: '83'
    }, {
      propertyId: 10,
      value: '84'
    }]
  }, {
    brandId: 1,
    categoryId: 2,
    name: 'PocketRocket Deluxe',

    properties: [{
      propertyId: 10,
      value: ''
    }]
  }])('should reject invalid item submission create bodies: %j', (body) => {
    expect(() => validateItemSubmissionCreateBody(body)).toThrow(/./u)
  })

  it.each(['approved', 'rejected'])('should accept item submission moderation status: %s', (status) => {
    const result = validateItemSubmissionModerationBody({
      status
    })

    expect(result).toStrictEqual({
      status
    })
  })

  it.each([{}, { status: 'pending' }, { status: true }])('should reject invalid item submission moderation bodies: %j', (body) => {
    expect(() => validateItemSubmissionModerationBody(body)).toThrow(/./u)
  })

  it('should accept canonical uuid v7 inventory create bodies only', () => {
    const result = validateUserEquipmentCreateBody({
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(result).toStrictEqual({
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(() => validateUserEquipmentCreateBody({
      itemId: '550e8400-e29b-41d4-a716-446655440000'
    })).toThrow(/./u)
  })

  it('should accept canonical uuid v7 inventory id params only', () => {
    const result = validateUserEquipmentIdParams({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(result).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    expect(() => validateUserEquipmentIdParams({
      id: '550e8400-e29b-41d4-a716-446655440000'
    })).toThrow(/./u)
  })

  it('should trim twitch oauth body and reject empty code', () => {
    expect(validateTwitchOAuthBody({
      code: '  oauth-code  '
    })).toStrictEqual({
      code: 'oauth-code'
    })

    expect(() => validateTwitchOAuthBody({
      code: '   '
    })).toThrow(/./u)
  })

  it('should sanitize redirect query targets', () => {
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
