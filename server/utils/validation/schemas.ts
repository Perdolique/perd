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
  v.maxValue(100)
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

function validateCategoryIdParams(params: unknown) {
  return v.parse(categoryIdParamsSchema, params)
}

function validateCategoryMutationBody(body: unknown) {
  return v.parse(categoryMutationSchema, body)
}

function validateItemDetailParams(params: unknown) {
  return v.parse(itemDetailParamsSchema, params)
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
  groupIdParamsSchema,
  groupMutationSchema,
  itemDetailParamsSchema,
  itemsListQuerySchema,
  limitQuerySchema,
  nonEmptyStringSchema,
  pageQuerySchema,
  positiveIntegerIdParamSchema,
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
  validateGroupIdParams,
  validateGroupMutationBody,
  validateItemDetailParams,
  validateItemsListQuery,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody
}
