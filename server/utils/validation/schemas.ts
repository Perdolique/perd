// oxlint-disable max-lines
import * as v from 'valibot'
import { limits, startPagePath } from '#shared/constants'

import {
  compareDecimalNumbers,
  decimalNumberPattern,
  isFiniteDecimalNumber,
  normalizeDecimalNumber
} from '#shared/utils/decimal-number'

import { isEmailAuthenticationPasswordValid, normalizeEmail } from '#shared/utils/email-authentication'
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

const propertiesRevisionSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2_147_483_647))

// Nitro's Cloudflare adapter drops DELETE bodies, so deletion preconditions use the URL query.
const propertiesRevisionQuerySchema = v.object({
  expectedPropertiesRevision: v.pipe(v.string(), v.digits(), v.toNumber(), propertiesRevisionSchema)
})

const categoryPropertyDeleteQuerySchema = v.object({
  ...propertiesRevisionQuerySchema.entries,
  expectedAffectedItemCount: v.pipe(v.string(), v.digits(), v.toNumber(), v.integer(), v.minValue(0))
})

const categoryPropertiesOrderSchema = v.pipe(
  v.object({
    expectedPropertiesRevision: propertiesRevisionSchema,
    propertyIds: v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))
  }),
  v.forward(v.check((input) => {
    const uniqueIds = new Set(input.propertyIds)

    return uniqueIds.size === input.propertyIds.length
  }, 'Include each characteristic once.'), ['propertyIds'])
)

const propertyEnumOptionRevisionMutationSchema = v.object({
  ...propertyEnumOptionMutationSchema.entries,
  expectedPropertiesRevision: propertiesRevisionSchema
})

const categoryPropertyUpdateSchema = v.pipe(
  v.object({
    expectedPropertiesRevision: propertiesRevisionSchema,
    name: v.pipe(trimmedNonEmptyStringSchema, v.maxLength(limits.maxCategoryPropertyNameLength)),
    slug: v.pipe(referenceDataSlugSchema, v.maxLength(limits.maxCategoryPropertySlugLength)),
    dataType: categoryPropertyDataTypeSchema,
    allowsNegativeValues: v.optional(v.boolean(), false),
    unit: v.optional(v.nullable(v.pipe(trimmedNonEmptyStringSchema, v.maxLength(limits.maxCategoryPropertyUnitLength)))),
    enumOptions: v.optional(v.pipe(v.array(propertyEnumOptionMutationSchema), v.minLength(1)))
  }),
  v.forward(v.check((input) => input.enumOptions === undefined || input.dataType === 'enum',
    'Options are only allowed for enum characteristics.'), ['enumOptions']),
  v.forward(v.check((input) => (input.unit === null || input.unit === undefined) || input.dataType === 'number',
    'Units are only allowed for number characteristics.'), ['unit']),
  v.forward(v.check((input) => !input.allowsNegativeValues || input.dataType === 'number',
    'Negative values are only allowed for number characteristics.'), ['allowsNegativeValues']),
  v.forward(v.check((input) => {
    const slugs = input.enumOptions?.map((option) => option.slug) ?? []
    const uniqueSlugs = new Set(slugs)

    return uniqueSlugs.size === slugs.length
  }, 'Options must have unique slugs.'), ['enumOptions'])
)

const categoryPropertyMutationSchema = v.pipe(
  categoryPropertyUpdateSchema,
  v.forward(v.check((input) => input.dataType !== 'enum' || input.enumOptions !== undefined,
    'Add at least one option.'), ['enumOptions'])
)

function validateCategoryPropertyUpdateBody(body: unknown) {
  return v.parse(categoryPropertyUpdateSchema, body)
}

function validateCategoryPropertyDeleteQuery(query: unknown) {
  return v.parse(categoryPropertyDeleteQuerySchema, query)
}

function validateCategoryPropertiesOrderBody(body: unknown) {
  return v.parse(categoryPropertiesOrderSchema, body)
}

function validatePropertiesRevisionQuery(query: unknown) {
  return v.parse(propertiesRevisionQuerySchema, query)
}

function validatePropertyEnumOptionRevisionMutationBody(body: unknown) {
  return v.parse(propertyEnumOptionRevisionMutationSchema, body)
}

const categoryDetailParamsSchema = v.object({
  slug: referenceDataSlugSchema
})

const itemDetailParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const equipmentImageDeliveryParamsSchema = v.object({
  'cloudflare-image-id': nonEmptyStringSchema
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

    expectedPropertiesRevision: v.optional(propertiesRevisionSchema),
    properties: v.optional(v.array(itemSubmissionPropertySchema), []),

    sourceUrl: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxEquipmentItemSubmissionSourceUrlLength),
      v.regex(/^https:\/\//iu, 'sourceUrl must be an absolute HTTPS URL'),
      v.url()
    )
  }),
  v.check((input) => {
    const propertyIds = input.properties.map((property) => property.propertyId)

    return new Set(propertyIds).size === propertyIds.length
  }, 'properties must contain unique propertyId values'),
  v.check((input) => input.properties.length === 0 || input.expectedPropertiesRevision !== undefined,
    'A properties revision is required when submitting characteristics.')
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

    expectedPropertiesRevision: propertiesRevisionSchema,
    expectedOriginalPropertiesRevision: propertiesRevisionSchema,

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

const equipmentItemUpdateBodySchema = v.pipe(
  v.strictObject({
    brandId: v.pipe(v.number(), v.integer(), v.minValue(1)),
    categoryId: v.pipe(v.number(), v.integer(), v.minValue(1)),
    name: v.pipe(trimmedNonEmptyStringSchema, v.maxLength(limits.maxEquipmentItemNameLength)),
    properties: v.array(itemSubmissionPropertySchema),
    expectedItemRevision: propertiesRevisionSchema,
    expectedOriginalPropertiesRevision: propertiesRevisionSchema,
    expectedPropertiesRevision: propertiesRevisionSchema,
    categoryChangeConfirmed: v.optional(v.boolean(), false)
  }),
  v.check((input) => {
    const propertyIds = input.properties.map((property) => property.propertyId)

    return new Set(propertyIds).size === propertyIds.length
  }, 'properties must contain unique propertyId values')
)

function validateEquipmentItemUpdateBody(body: unknown) {
  return v.parse(equipmentItemUpdateBodySchema, body)
}

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

const photoSubmissionAdminListQuerySchema = v.pipe(
  v.object({
    afterCreatedAt: v.optional(v.pipe(
      v.string(),
      v.isoTimestamp()
    )),

    afterId: v.optional(canonicalUuidV7Schema),
    limit: limitQuerySchema
  }),
  v.check(
    (input) => (input.afterCreatedAt === undefined) === (input.afterId === undefined),
    'afterCreatedAt and afterId must be provided together'
  )
)

const photoSubmissionParamsSchema = v.object({
  id: canonicalUuidV7Schema
})

const photoSubmissionDecisionBodySchema = v.variant('decision', [
  v.strictObject({
    decision: v.literal('publish'),
    makePrimary: v.boolean()
  }),
  v.strictObject({
    decision: v.literal('reject'),

    rejectionReason: v.pipe(
      trimmedNonEmptyStringSchema,
      v.maxLength(limits.maxEquipmentItemRejectionReasonLength)
    )
  })
])

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

const twitchOAuthQuerySchema = v.object({
  redirectTo: redirectTargetQuerySchema.entries.redirectTo,
  intent: v.optional(v.picklist(['sign-in', 'link']), 'sign-in'),
  responseMode: v.optional(v.picklist(['redirect', 'json']), 'redirect')
})

const twitchOAuthStateSchema = v.pipe(v.string(), v.regex(/^[\w-]{43}$/u))

const twitchOAuthBodySchema = v.union([
  v.strictObject({
    code: trimmedNonEmptyStringSchema,
    state: twitchOAuthStateSchema
  }),
  v.strictObject({
    error: v.pipe(trimmedNonEmptyStringSchema, v.maxLength(128)),
    state: twitchOAuthStateSchema
  })
])

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

function validateCategoryScopedParams(params: unknown) {
  return v.parse(categoryScopedParamsSchema, params)
}

function validateCategoryMutationBody(body: unknown) {
  return v.parse(categoryMutationSchema, body)
}

function validateItemDetailParams(params: unknown) {
  return v.parse(itemDetailParamsSchema, params)
}

function validateEquipmentImageDeliveryParams(params: unknown) {
  return v.parse(equipmentImageDeliveryParamsSchema, params)
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

function validatePhotoSubmissionAdminListQuery(query: unknown) {
  return v.parse(photoSubmissionAdminListQuerySchema, query)
}

function validatePhotoSubmissionParams(params: unknown) {
  return v.parse(photoSubmissionParamsSchema, params)
}

function validatePhotoSubmissionDecisionBody(body: unknown) {
  return v.parse(photoSubmissionDecisionBodySchema, body)
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

function validateTwitchOAuthQuery(query: unknown) {
  return v.parse(twitchOAuthQuerySchema, query)
}

const emailAuthenticationPasswordSchema = v.pipe(
  v.string(),
  v.check(isEmailAuthenticationPasswordValid, 'Use a password between 15 and 128 characters')
)

const emailRegistrationSchema = v.object({
  email: v.pipe(v.string(), v.transform(normalizeEmail), v.maxLength(254), v.email()),
  password: emailAuthenticationPasswordSchema,
  redirectTo: v.pipe(v.optional(v.string(), '/'), v.transform((value) => sanitizeRedirectPath(value))),
  'cf-turnstile-response': v.unknown()
})

const emailVerificationSchema = v.object({
  token: v.pipe(v.string(), v.regex(/^[\w-]{43}$/u)),
  password: emailAuthenticationPasswordSchema
})

const emailSignInSchema = v.object({
  email: v.pipe(v.string(), v.transform(normalizeEmail), v.maxLength(254), v.email()),
  password: emailAuthenticationPasswordSchema,
  'cf-turnstile-response': v.unknown()
})

const passwordRecoveryRequestSchema = v.object({
  email: v.pipe(v.string(), v.transform(normalizeEmail), v.maxLength(254), v.email()),
  redirectTo: v.pipe(v.optional(v.string(), '/'), v.transform((value) => sanitizeRedirectPath(value))),
  'cf-turnstile-response': v.unknown()
})

const passwordRecoveryResetSchema = v.object({
  token: v.string(),
  password: emailAuthenticationPasswordSchema,
  'cf-turnstile-response': v.unknown()
})

function validateEmailRegistration(value: unknown) {
  const parsed = v.safeParse(emailRegistrationSchema, value)

  return parsed.success ? parsed.output : false
}

function validateEmailVerification(value: unknown) {
  const parsed = v.safeParse(emailVerificationSchema, value)

  return parsed.success ? parsed.output : false
}

function validateEmailSignIn(value: unknown) {
  const parsed = v.safeParse(emailSignInSchema, value)

  return parsed.success ? parsed.output : false
}

function validatePasswordRecoveryRequest(value: unknown) {
  const parsed = v.safeParse(passwordRecoveryRequestSchema, value)

  return parsed.success ? parsed.output : false
}

function validatePasswordRecoveryReset(value: unknown) {
  const parsed = v.safeParse(passwordRecoveryResetSchema, value)

  return parsed.success ? parsed.output : false
}

const passkeyNameSchema = v.object({
  name: v.pipe(trimmedNonEmptyStringSchema, v.maxLength(64))
})

const passkeyIdParamsSchema = v.object({ id: canonicalUuidV7Schema })
const passkeyOptionsBodySchema = v.object({})
const passkeyBase64Schema = v.pipe(v.string(), v.nonEmpty(), v.regex(/^[\w-]+$/u))
const passkeyTransportsSchema = v.array(v.picklist(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']))

const passkeyRegistrationSchema = v.object({
  ceremonyId: canonicalUuidV7Schema,

  credential: v.object({
    id: passkeyBase64Schema,
    rawId: passkeyBase64Schema,
    type: v.literal('public-key'),
    authenticatorAttachment: v.optional(v.picklist(['platform', 'cross-platform'])),

    clientExtensionResults: v.object({
      credProps: v.optional(v.object({ rk: v.optional(v.boolean()) }))
    }),

    response: v.object({
      clientDataJSON: passkeyBase64Schema,
      attestationObject: passkeyBase64Schema,
      transports: v.optional(passkeyTransportsSchema)
    })
  })
})

const passkeyAuthenticationSchema = v.object({
  ceremonyId: canonicalUuidV7Schema,

  credential: v.object({
    id: passkeyBase64Schema,
    rawId: passkeyBase64Schema,
    type: v.literal('public-key'),
    authenticatorAttachment: v.optional(v.picklist(['platform', 'cross-platform'])),
    clientExtensionResults: v.object({}),

    response: v.object({
      clientDataJSON: passkeyBase64Schema,
      authenticatorData: passkeyBase64Schema,
      signature: passkeyBase64Schema,
      userHandle: passkeyBase64Schema
    })
  })
})

function validatePasskeyName(value: unknown) {
  const parsed = v.safeParse(passkeyNameSchema, value)

  return parsed.success ? parsed.output : false
}

function validatePasskeyOptions(value: unknown) {
  const parsed = v.safeParse(passkeyOptionsBodySchema, value)

  return parsed.success ? parsed.output : false
}

function validatePasskeyIdParams(value: unknown) {
  return v.parse(passkeyIdParamsSchema, value)
}

function validatePasskeyRegistration(value: unknown) {
  const parsed = v.safeParse(passkeyRegistrationSchema, value)

  return parsed.success ? parsed.output : false
}

function validatePasskeyAuthentication(value: unknown) {
  const parsed = v.safeParse(passkeyAuthenticationSchema, value)

  return parsed.success ? parsed.output : false
}

export {
  validateEquipmentItemUpdateBody,
  categoryPropertyUpdateSchema,
  categoryPropertyDeleteQuerySchema,
  categoryPropertiesOrderSchema,
  propertiesRevisionQuerySchema,
  propertyEnumOptionRevisionMutationSchema,
  validateCategoryPropertyUpdateBody,
  validateCategoryPropertyDeleteQuery,
  validateCategoryPropertiesOrderBody,
  validatePropertiesRevisionQuery,
  validatePropertyEnumOptionRevisionMutationBody,
  validatePasskeyAuthentication,
  validatePasskeyRegistration,
  validatePasskeyName,
  validatePasskeyOptions,
  validatePasskeyIdParams,
  validateEmailRegistration,
  validateEmailSignIn,
  validateEmailVerification,
  validatePasswordRecoveryRequest,
  validatePasswordRecoveryReset,
  brandMutationSchema,
  brandIdParamsSchema,
  brandDetailParamsSchema,
  brandsListQuerySchema,
  canonicalUuidV7Schema,
  categoryDetailParamsSchema,
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
  photoSubmissionDecisionBodySchema,
  photoSubmissionAdminListQuerySchema,
  photoSubmissionListQuerySchema,
  photoSubmissionParamsSchema,
  equipmentImageDeliveryParamsSchema,
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
  userEquipmentCreateBodySchema,
  userEquipmentIdParamsSchema,
  validateBrandDetailParams,
  validateBrandIdParams,
  validateBrandMutationBody,
  validateBrandsListQuery,
  validateCategoryDetailParams,
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
  validatePhotoSubmissionDecisionBody,
  validatePhotoSubmissionAdminListQuery,
  validatePhotoSubmissionIdempotencyKey,
  validatePhotoSubmissionListQuery,
  validatePhotoSubmissionParams,
  validateEquipmentImageDeliveryParams,
  validateEquipmentComparisonQuery,
  validateItemsListQuery,
  validatePackingListAvailableGearQuery,
  validatePackingListEntryCreateBody,
  validatePackingListEntryParams,
  validatePackingListEntryUpdateBody,
  validatePackingListIdParams,
  validatePackingListMutationBody,
  validatePropertyEnumOptionParams,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody,
  validateTwitchOAuthQuery,
  validateUserEquipmentCreateBody,
  validateUserEquipmentIdParams
}

export type {
  ItemsListBooleanFilter,
  ItemsListEnumFilter,
  ItemsListNumberFilter,
  ItemsListSort
}
