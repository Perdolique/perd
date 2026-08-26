// oxlint-disable max-lines
import * as v from 'valibot'
import { limits, startPagePath } from '#shared/constants'

import {
  compareDecimalNumbers,
  decimalNumberPattern,
  isFiniteDecimalNumber,
  normalizeDecimalNumber
} from '#shared/utils/decimal-number'

import { sanitizeRedirectPath } from '#shared/utils/redirect'

const nonEmptyStringSchema = v.pipe(
  v.string(),
  v.nonEmpty()
)

const trimmedStringSchema = v.pipe(
  v.string(),
  v.trim()
)

const trimmedNonEmptyStringSchema = v.pipe(
  trimmedStringSchema,
  v.nonEmpty()
)

const positiveIntegerIdParamSchema = v.pipe(
  v.string(),
  v.regex(/^[1-9]\d*$/u),
  v.toNumber()
)

const canonicalUuidV7Schema = v.pipe(
  v.string(),
  v.regex(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u)
)

const idempotencyKeySchema = v.pipe(
  v.string(),
  v.uuid()
)

const referenceDataSlugSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
)

const limitQuerySchema = v.pipe(
  v.optional(v.string(), '20'),
  v.digits(),
  v.toNumber(),
  v.integer(),
  v.minValue(1),
  v.transform((value) => Math.min(value, limits.maxPaginatedListLimit))
)

const pageQuerySchema = v.pipe(
  v.optional(v.string(), '1'),
  v.digits(),
  v.toNumber(),
  v.integer(),
  v.minValue(1)
)

const brandMutationSchema = v.object({
  name: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxBrandNameLength)
  ),

  slug: v.pipe(
    referenceDataSlugSchema,
    v.maxLength(limits.maxBrandSlugLength)
  )
})

const brandIdParamsSchema = v.object({
  id: positiveIntegerIdParamSchema
})

const brandDetailParamsSchema = v.object({
  slug: referenceDataSlugSchema
})

const brandsListQuerySchema = v.object({
  search: v.optional(trimmedStringSchema, '')
})

const groupMutationSchema = v.object({
  name: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxEquipmentGroupNameLength)
  ),

  slug: v.pipe(
    referenceDataSlugSchema,
    v.maxLength(limits.maxEquipmentGroupSlugLength)
  )
})

const groupIdParamsSchema = v.object({
  id: positiveIntegerIdParamSchema
})

const categoryMutationSchema = v.object({
  name: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxEquipmentCategoryNameLength)
  ),

  slug: v.pipe(
    referenceDataSlugSchema,
    v.maxLength(limits.maxEquipmentCategorySlugLength)
  )
})

const categoryIdParamsSchema = v.object({
  id: positiveIntegerIdParamSchema
})

const categoryScopedParamsSchema = v.object({
  categoryId: positiveIntegerIdParamSchema
})

const categoryPropertyDataTypeSchema = v.picklist([
  'number',
  'text',
  'boolean',
  'enum'
])

const categoryPropertyParamsSchema = v.object({
  categoryId: positiveIntegerIdParamSchema,
  propertyId: positiveIntegerIdParamSchema
})

const propertyEnumOptionParamsSchema = v.object({
  categoryId: positiveIntegerIdParamSchema,
  propertyId: positiveIntegerIdParamSchema,
  optionId: positiveIntegerIdParamSchema
})

const propertyEnumOptionMutationSchema = v.object({
  name: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxPropertyEnumOptionNameLength)
  ),

  slug: v.pipe(
    referenceDataSlugSchema,
    v.maxLength(limits.maxPropertyEnumOptionSlugLength)
  )
})

const categoryPropertyMutationSchema = v.pipe(
  v.object({
    name: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxCategoryPropertyNameLength)
    ),

    slug: v.pipe(
      referenceDataSlugSchema,
      v.maxLength(limits.maxCategoryPropertySlugLength)
    ),

    dataType: categoryPropertyDataTypeSchema,

    unit: v.optional(
      v.pipe(
        trimmedNonEmptyStringSchema,
        v.maxLength(limits.maxCategoryPropertyUnitLength)
      )
    ),

    enumOptions: v.optional(
      v.array(propertyEnumOptionMutationSchema)
    )
  }),
  v.check((input) => {
    if (input.dataType === 'enum') {
      return input.enumOptions !== undefined && input.enumOptions.length > 0
    }

    return input.enumOptions === undefined
  }, 'enumOptions must be provided for enum properties and omitted otherwise'),
  v.check((input) => input.unit === undefined || input.dataType === 'number', 'unit can only be provided for number properties'),
  v.check((input) => {
    if (input.enumOptions === undefined) {
      return true
    }

    const optionSlugs = input.enumOptions.map((option) => option.slug)

    return new Set(optionSlugs).size === optionSlugs.length
  }, 'enumOptions must contain unique slugs')
)

const categoryDetailParamsSchema = v.object({
  slug: referenceDataSlugSchema
})

const itemDetailParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const itemSubmissionPropertyValueSchema = v.union([
  v.boolean(),
  v.string()
])

const itemSubmissionPropertySchema = v.object({
  propertyId: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1)
  ),

  value: itemSubmissionPropertyValueSchema
})

const itemSubmissionCreateBodySchema = v.pipe(
  v.object({
    brandId: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    ),

    categoryId: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    ),

    name: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxEquipmentItemNameLength)
    ),

    properties: v.optional(v.array(itemSubmissionPropertySchema), [])
  }),
  v.check((input) => {
    const propertyIds = input.properties.map((property) => property.propertyId)

    return new Set(propertyIds).size === propertyIds.length
  }, 'properties must contain unique propertyId values')
)

const itemSubmissionListQuerySchema = v.object({
  limit: v.pipe(
    v.optional(v.string(), '20'),
    v.digits(),
    v.toNumber(),
    v.integer(),
    v.minValue(1),
    v.maxValue(100)
  ),

  page: v.pipe(
    v.optional(v.string(), '1'),
    v.digits(),
    v.toNumber(),
    v.integer(),
    v.minValue(1)
  )
})

const itemSubmissionParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const itemSubmissionUpdateBodySchema = v.pipe(
  v.object({
    brandId: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    ),

    categoryId: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1)
    ),

    expectedUpdatedAt: v.pipe(
      v.string(),
      v.isoTimestamp()
    ),

    name: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxEquipmentItemNameLength)
    ),

    decision: v.optional(v.picklist(['publish', 'reject'])),

    rejectionReason: v.optional(v.pipe(
      trimmedStringSchema,
      v.maxLength(limits.maxEquipmentItemRejectionReasonLength)
    )),

    properties: v.array(itemSubmissionPropertySchema)
  }),
  v.check((input) => {
    const propertyIds = input.properties.map((property) => property.propertyId)

    return new Set(propertyIds).size === propertyIds.length
  }, 'properties must contain unique propertyId values'),
  v.check((input) => {
    if (input.decision === 'reject') {
      return input.rejectionReason !== undefined && input.rejectionReason !== ''
    }

    return input.rejectionReason === undefined
  }, 'rejectionReason is required only when rejecting a submission')
)

const itemImageParamsSchema = v.object({
  id: canonicalUuidV7Schema,
  'image-id': canonicalUuidV7Schema
})

const itemImageOrderBodySchema = v.object({
  imageIds: v.array(canonicalUuidV7Schema)
})

const itemImageUploadQuerySchema = v.object({
  filename: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxEquipmentItemImageFilenameLength)
  )
})

const photoSubmissionHttpsUrlSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.maxLength(limits.maxEquipmentItemPhotoSubmissionSourceUrlLength),
  v.url(),
  v.check(
    (sourceUrl) => new globalThis.URL(sourceUrl).protocol === 'https:',
    'sourceUrl must use HTTPS'
  )
)

const photoSubmissionCreateBodySchema = v.pipe(
  v.object({
    filename: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxEquipmentItemImageFilenameLength)
    ),

    rightsConfirmed: v.literal('true'),
    sourceType: v.picklist(['own', 'manufacturer']),
    sourceUrl: v.optional(photoSubmissionHttpsUrlSchema)
  }),
  v.check((input) => {
    if (input.sourceType === 'manufacturer') {
      return input.sourceUrl !== undefined
    }

    return input.sourceUrl === undefined
  }, 'sourceUrl is required only for manufacturer photos')
)

const photoSubmissionListQuerySchema = v.object({
  page: pageQuerySchema
})

const minimumEquipmentComparisonItemCount = 2
const maximumEquipmentComparisonItemCount = 4

const equipmentComparisonItemIdsQuerySchema = v.pipe(
  v.array(canonicalUuidV7Schema),
  v.minLength(minimumEquipmentComparisonItemCount),
  v.maxLength(maximumEquipmentComparisonItemCount),
  v.check((itemIds) => new Set(itemIds).size === itemIds.length, 'itemId must contain unique values')
)

const equipmentComparisonQuerySchema = v.object({
  itemId: equipmentComparisonItemIdsQuerySchema
})

const userEquipmentIdParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const userEquipmentCreateBodySchema = v.object({
  itemId: canonicalUuidV7Schema
})

const packingListIdParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const packingListEntryParamsSchema = v.pipe(
  v.looseObject({
    id: canonicalUuidV7Schema,
    entryId: v.optional(canonicalUuidV7Schema),
    'entry-id': v.optional(canonicalUuidV7Schema)
  }),
  v.check((params) => params.entryId !== undefined || params['entry-id'] !== undefined, 'entryId is required'),
  v.transform((params) => {
    const entryId = params.entryId ?? params['entry-id']

    if (entryId === undefined) {
      return {
        entryId: '',
        id: params.id
      }
    }

    return {
      entryId,
      id: params.id
    }
  })
)

const packingListMutationBodySchema = v.object({
  name: v.pipe(
    trimmedNonEmptyStringSchema,
    v.maxLength(limits.maxPackingListNameLength)
  )
})

const packingListEntryCreateBodySchema = v.pipe(
  v.object({
    customName: v.optional(
      v.pipe(
        trimmedNonEmptyStringSchema,
        v.maxLength(limits.maxPackingListEntryCustomNameLength)
      )
    ),

    inventoryId: v.optional(canonicalUuidV7Schema)
  }),
  v.check((body) => {
    const hasCustomName = body.customName !== undefined
    const hasInventoryId = body.inventoryId !== undefined

    return hasCustomName !== hasInventoryId
  }, 'Exactly one of customName or inventoryId is required')
)

const packingListEntryUpdateBodySchema = v.object({
  isPacked: v.boolean()
})

const packingListAvailableGearQuerySchema = v.object({
  page: pageQuerySchema,

  search: v.pipe(
    v.optional(trimmedStringSchema, ''),
    v.maxLength(limits.maxPackingListEntryCustomNameLength)
  )
})

interface ItemsListNumberFilter {
  max: string | null;
  min: string | null;
  propertySlug: string;
}

interface ItemsListEnumFilter {
  optionSlug: string;
  propertySlug: string;
}

interface ItemsListBooleanFilter {
  propertySlug: string;
  value: boolean;
}

type ItemsListSort = 'brand' | 'name' | `property:${string}`

const brandFilterSlugSchema = v.pipe(
  referenceDataSlugSchema,
  v.maxLength(limits.maxBrandSlugLength)
)

const categoryFilterSlugSchema = v.pipe(
  referenceDataSlugSchema,
  v.maxLength(limits.maxEquipmentCategorySlugLength)
)

const categoryPropertyFilterSlugSchema = v.pipe(
  referenceDataSlugSchema,
  v.maxLength(limits.maxCategoryPropertySlugLength)
)

const propertyEnumOptionFilterSlugSchema = v.pipe(
  referenceDataSlugSchema,
  v.maxLength(limits.maxPropertyEnumOptionSlugLength)
)

const numberFilterFormatMessage = 'numberFilter must use <property-slug>:<min-or-empty>:<max-or-empty>'

const decimalFilterBoundSchema = v.union([
  v.pipe(
    v.literal(''),
    v.transform(() => null)
  ),

  v.pipe(
    v.string(),
    v.regex(decimalNumberPattern),
    v.check(isFiniteDecimalNumber),
    v.transform(normalizeDecimalNumber)
  )
])

const numberFilterQueryValueSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.transform((value) => value.split(':')),
  v.strictTuple([
    categoryPropertyFilterSlugSchema,
    decimalFilterBoundSchema,
    decimalFilterBoundSchema
  ], numberFilterFormatMessage),
  v.check(([, min, max]) => min !== null || max !== null, numberFilterFormatMessage),
  v.check(
    ([, min, max]) => min === null || max === null || compareDecimalNumbers(min, max) <= 0,
    numberFilterFormatMessage
  ),
  v.transform(([propertySlug, min, max]): ItemsListNumberFilter => {
    return {
      max,
      min,
      propertySlug
    }
  })
)

const enumFilterQueryValueSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.transform((value) => value.split(':')),
  v.strictTuple([
    categoryPropertyFilterSlugSchema,
    propertyEnumOptionFilterSlugSchema
  ], 'enumFilter must use <property-slug>:<option-slug>'),
  v.transform(([propertySlug, optionSlug]): ItemsListEnumFilter => {
    return {
      optionSlug,
      propertySlug
    }
  })
)

const booleanFilterQueryValueSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.transform((value) => value.split(':')),
  v.strictTuple([
    categoryPropertyFilterSlugSchema,
    v.picklist(['true', 'false'])
  ], 'booleanFilter must use <property-slug>:true|false'),
  v.transform(([propertySlug, value]): ItemsListBooleanFilter => {
    return {
      propertySlug,
      value: value === 'true'
    }
  })
)

const propertySortPrefix = 'property:'

const propertyItemsListSortSchema = v.pipe(
  v.string(),
  v.startsWith(propertySortPrefix),
  v.transform((value) => value.slice(propertySortPrefix.length)),
  categoryPropertyFilterSlugSchema,
  v.transform((propertySlug): ItemsListSort => `property:${propertySlug}`)
)

const itemsListSortSchema = v.pipe(
  v.optional(trimmedNonEmptyStringSchema, 'name'),
  v.union([
    v.picklist(['name', 'brand']),
    propertyItemsListSortSchema
  ], 'sort must be name, brand, or property:<property-slug>')
)

function deduplicateByKey<TValue>(values: TValue[], getKey: (value: TValue) => string): TValue[] {
  const seenKeys = new Set<string>()
  const uniqueValues: TValue[] = []

  for (const value of values) {
    const key = getKey(value)

    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      uniqueValues.push(value)
    }
  }

  return uniqueValues
}

function getNumberFilterKey(filter: ItemsListNumberFilter): string {
  return `${filter.propertySlug}:${filter.min ?? ''}:${filter.max ?? ''}`
}

function getEnumFilterKey(filter: ItemsListEnumFilter): string {
  return `${filter.propertySlug}:${filter.optionSlug}`
}

function getBooleanFilterKey(filter: ItemsListBooleanFilter): string {
  return `${filter.propertySlug}:${filter.value}`
}

function hasConflictingNumberFilters(filters: ItemsListNumberFilter[]): boolean {
  const filtersByProperty = new Map<string, ItemsListNumberFilter>()

  for (const filter of filters) {
    const existingFilter = filtersByProperty.get(filter.propertySlug)

    if (existingFilter === undefined) {
      filtersByProperty.set(filter.propertySlug, filter)
    } else {
      const hasDifferentMin = existingFilter.min !== filter.min
      const hasDifferentMax = existingFilter.max !== filter.max

      if (hasDifferentMin || hasDifferentMax) {
        return true
      }
    }
  }

  return false
}

function hasConflictingBooleanFilters(filters: ItemsListBooleanFilter[]): boolean {
  const valuesByProperty = new Map<string, boolean>()

  for (const filter of filters) {
    const existingValue = valuesByProperty.get(filter.propertySlug)

    if (existingValue === undefined) {
      valuesByProperty.set(filter.propertySlug, filter.value)
    } else if (existingValue !== filter.value) {
      return true
    }
  }

  return false
}

const brandSlugListQuerySchema = v.pipe(
  v.optional(v.union([
    brandFilterSlugSchema,
    v.pipe(
      v.array(brandFilterSlugSchema),
      v.maxLength(limits.maxEquipmentItemsFilterCount)
    )
  ]), []),
  v.transform((value) => {
    const values = Array.isArray(value) ? value : [value]
    const uniqueValues = new Set(values)

    return [...uniqueValues]
  })
)

const numberFilterListQuerySchema = v.pipe(
  v.optional(v.union([
    numberFilterQueryValueSchema,
    v.pipe(
      v.array(numberFilterQueryValueSchema),
      v.maxLength(limits.maxEquipmentItemsFilterCount)
    )
  ]), []),
  v.transform((value) => {
    const values = Array.isArray(value) ? value : [value]

    return deduplicateByKey(values, getNumberFilterKey)
  })
)

const enumFilterListQuerySchema = v.pipe(
  v.optional(v.union([
    enumFilterQueryValueSchema,
    v.pipe(
      v.array(enumFilterQueryValueSchema),
      v.maxLength(limits.maxEquipmentItemsFilterCount)
    )
  ]), []),
  v.transform((value) => {
    const values = Array.isArray(value) ? value : [value]

    return deduplicateByKey(values, getEnumFilterKey)
  })
)

const booleanFilterListQuerySchema = v.pipe(
  v.optional(v.union([
    booleanFilterQueryValueSchema,
    v.pipe(
      v.array(booleanFilterQueryValueSchema),
      v.maxLength(limits.maxEquipmentItemsFilterCount)
    )
  ]), []),
  v.transform((value) => {
    const values = Array.isArray(value) ? value : [value]

    return deduplicateByKey(values, getBooleanFilterKey)
  })
)

const itemsListQuerySchema = v.pipe(
  v.object({
    booleanFilter: booleanFilterListQuerySchema,
    brandSlug: brandSlugListQuerySchema,
    categorySlug: v.optional(categoryFilterSlugSchema),
    direction: v.optional(v.picklist(['asc', 'desc']), 'asc'),
    enumFilter: enumFilterListQuerySchema,
    limit: limitQuerySchema,
    numberFilter: numberFilterListQuerySchema,
    page: pageQuerySchema,
    search: v.optional(trimmedStringSchema, ''),
    sort: itemsListSortSchema
  }),
  v.check((query) => {
    const hasConflict = hasConflictingNumberFilters(query.numberFilter)

    return !hasConflict
  }, 'numberFilter cannot contain different ranges for one property'),
  v.check((query) => {
    const hasConflict = hasConflictingBooleanFilters(query.booleanFilter)

    return !hasConflict
  }, 'booleanFilter cannot contain different values for one property'),
  v.check((query) => {
    const propertyFilterCount = query.numberFilter.length
      + query.enumFilter.length
      + query.booleanFilter.length

    return propertyFilterCount <= limits.maxEquipmentItemsFilterCount
  }, `property filters cannot contain more than ${limits.maxEquipmentItemsFilterCount} values`),
  v.check((query) => {
    const hasPropertyFilters = query.numberFilter.length > 0
      || query.enumFilter.length > 0
      || query.booleanFilter.length > 0

    const hasPropertySort = query.sort.startsWith('property:')
    const requiresCategory = hasPropertyFilters || hasPropertySort

    return !requiresCategory || query.categorySlug !== undefined
  }, 'categorySlug is required for property filters and sorting')
)

const redirectTargetQuerySchema = v.object({
  redirectTo: v.pipe(
    v.optional(trimmedStringSchema, startPagePath),
    v.transform((value) => sanitizeRedirectPath(value))
  )
})

const twitchOAuthBodySchema = v.object({
  code: trimmedNonEmptyStringSchema
})

function validateBrandMutationBody(body: unknown) {
  return v.parse(brandMutationSchema, body)
}

function validateBrandIdParams(params: unknown) {
  return v.parse(brandIdParamsSchema, params)
}

function validateBrandDetailParams(params: unknown) {
  return v.parse(brandDetailParamsSchema, params)
}

function validateBrandsListQuery(query: unknown) {
  return v.parse(brandsListQuerySchema, query)
}

function validateGroupMutationBody(body: unknown) {
  return v.parse(groupMutationSchema, body)
}

function validateGroupIdParams(params: unknown) {
  return v.parse(groupIdParamsSchema, params)
}

function validateCategoryDetailParams(params: unknown) {
  return v.parse(categoryDetailParamsSchema, params)
}

function validateCategoryPropertyMutationBody(body: unknown) {
  return v.parse(categoryPropertyMutationSchema, body)
}

function validateCategoryPropertyParams(params: unknown) {
  return v.parse(categoryPropertyParamsSchema, params)
}

function validateCategoryIdParams(params: unknown) {
  return v.parse(categoryIdParamsSchema, params)
}

function validateCategoryScopedParams(params: unknown) {
  return v.parse(categoryScopedParamsSchema, params)
}

function validateCategoryMutationBody(body: unknown) {
  return v.parse(categoryMutationSchema, body)
}

function validateItemDetailParams(params: unknown) {
  return v.parse(itemDetailParamsSchema, params)
}

function validateItemSubmissionCreateBody(body: unknown) {
  return v.parse(itemSubmissionCreateBodySchema, body)
}

function validateItemSubmissionListQuery(query: unknown) {
  return v.parse(itemSubmissionListQuerySchema, query)
}

function validateItemSubmissionParams(params: unknown) {
  return v.parse(itemSubmissionParamsSchema, params)
}

function validateItemSubmissionUpdateBody(body: unknown) {
  return v.parse(itemSubmissionUpdateBodySchema, body)
}

function validateItemImageParams(params: unknown) {
  return v.parse(itemImageParamsSchema, params)
}

function validateItemImageOrderBody(body: unknown) {
  return v.parse(itemImageOrderBodySchema, body)
}

function validateItemImageUploadQuery(query: unknown) {
  return v.parse(itemImageUploadQuerySchema, query)
}

function validatePhotoSubmissionCreateBody(body: unknown) {
  return v.parse(photoSubmissionCreateBodySchema, body)
}

function validatePhotoSubmissionIdempotencyKey(value: unknown) {
  return v.parse(idempotencyKeySchema, value)
}

function validatePhotoSubmissionListQuery(query: unknown) {
  return v.parse(photoSubmissionListQuerySchema, query)
}

function validateEquipmentComparisonQuery(query: unknown) {
  return v.parse(equipmentComparisonQuerySchema, query)
}

function validateUserEquipmentIdParams(params: unknown) {
  return v.parse(userEquipmentIdParamsSchema, params)
}

function validateUserEquipmentCreateBody(body: unknown) {
  return v.parse(userEquipmentCreateBodySchema, body)
}

function validatePackingListIdParams(params: unknown) {
  return v.parse(packingListIdParamsSchema, params)
}

function validatePackingListEntryParams(params: unknown) {
  return v.parse(packingListEntryParamsSchema, params)
}

function validatePackingListMutationBody(body: unknown) {
  return v.parse(packingListMutationBodySchema, body)
}

function validatePackingListEntryCreateBody(body: unknown) {
  return v.parse(packingListEntryCreateBodySchema, body)
}

function validatePackingListEntryUpdateBody(body: unknown) {
  return v.parse(packingListEntryUpdateBodySchema, body)
}

function validatePackingListAvailableGearQuery(query: unknown) {
  return v.parse(packingListAvailableGearQuerySchema, query)
}

function validatePropertyEnumOptionMutationBody(body: unknown) {
  return v.parse(propertyEnumOptionMutationSchema, body)
}

function validatePropertyEnumOptionParams(params: unknown) {
  return v.parse(propertyEnumOptionParamsSchema, params)
}

function validateItemsListQuery(query: unknown) {
  return v.parse(itemsListQuerySchema, query)
}

function validateRedirectTargetQuery(query: unknown) {
  return v.parse(redirectTargetQuerySchema, query)
}

function validateTwitchOAuthBody(body: unknown) {
  return v.parse(twitchOAuthBodySchema, body)
}

export {
  brandMutationSchema,
  brandIdParamsSchema,
  brandDetailParamsSchema,
  brandsListQuerySchema,
  canonicalUuidV7Schema,
  categoryDetailParamsSchema,
  categoryIdParamsSchema,
  categoryMutationSchema,
  categoryScopedParamsSchema,
  categoryPropertyDataTypeSchema,
  categoryPropertyMutationSchema,
  categoryPropertyParamsSchema,
  groupIdParamsSchema,
  groupMutationSchema,
  itemDetailParamsSchema,
  itemSubmissionCreateBodySchema,
  itemSubmissionListQuerySchema,
  itemSubmissionParamsSchema,
  itemSubmissionUpdateBodySchema,
  itemImageOrderBodySchema,
  itemImageParamsSchema,
  itemImageUploadQuerySchema,
  photoSubmissionCreateBodySchema,
  photoSubmissionListQuerySchema,
  equipmentComparisonQuerySchema,
  itemsListQuerySchema,
  limitQuerySchema,
  nonEmptyStringSchema,
  pageQuerySchema,
  packingListAvailableGearQuerySchema,
  packingListEntryCreateBodySchema,
  packingListEntryParamsSchema,
  packingListEntryUpdateBodySchema,
  packingListIdParamsSchema,
  packingListMutationBodySchema,
  positiveIntegerIdParamSchema,
  propertyEnumOptionMutationSchema,
  propertyEnumOptionParamsSchema,
  referenceDataSlugSchema,
  redirectTargetQuerySchema,
  trimmedNonEmptyStringSchema,
  trimmedStringSchema,
  twitchOAuthBodySchema,
  userEquipmentCreateBodySchema,
  userEquipmentIdParamsSchema,
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
  validateItemSubmissionListQuery,
  validateItemSubmissionParams,
  validateItemSubmissionUpdateBody,
  validateItemImageOrderBody,
  validateItemImageParams,
  validateItemImageUploadQuery,
  validatePhotoSubmissionCreateBody,
  validatePhotoSubmissionIdempotencyKey,
  validatePhotoSubmissionListQuery,
  validateEquipmentComparisonQuery,
  validateItemsListQuery,
  validatePackingListAvailableGearQuery,
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
}

export type {
  ItemsListBooleanFilter,
  ItemsListEnumFilter,
  ItemsListNumberFilter,
  ItemsListSort
}
