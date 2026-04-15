import * as v from 'valibot'
import { limits, startPagePath } from '#shared/constants'
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
  v.regex(/^[1-9]\d*$/),
  v.toNumber()
)

const canonicalUuidV7Schema = v.pipe(
  v.string(),
  v.regex(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
)

const referenceDataSlugSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
)

const optionalFilterQuerySchema = v.optional(
  v.pipe(
    trimmedStringSchema,
    v.transform((value) => value === '' ? undefined : value)
  )
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

const itemsListQuerySchema = v.object({
  brandSlug: optionalFilterQuerySchema,
  categorySlug: optionalFilterQuerySchema,
  limit: limitQuerySchema,
  page: pageQuerySchema,
  search: v.optional(trimmedStringSchema, '')
})

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
  itemsListQuerySchema,
  limitQuerySchema,
  nonEmptyStringSchema,
  pageQuerySchema,
  positiveIntegerIdParamSchema,
  propertyEnumOptionMutationSchema,
  propertyEnumOptionParamsSchema,
  referenceDataSlugSchema,
  redirectTargetQuerySchema,
  trimmedNonEmptyStringSchema,
  trimmedStringSchema,
  twitchOAuthBodySchema,
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
  validateItemsListQuery,
  validatePropertyEnumOptionMutationBody,
  validatePropertyEnumOptionParams,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody
}
