import * as v from 'valibot'
import { startPagePath } from '#shared/constants'
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
  name: trimmedNonEmptyStringSchema,
  slug: trimmedNonEmptyStringSchema
})

const brandIdParamsSchema = v.object({
  id: positiveIntegerIdParamSchema
})

const brandDetailParamsSchema = v.object({
  slug: trimmedNonEmptyStringSchema
})

const brandsListQuerySchema = v.object({
  search: v.optional(trimmedStringSchema, '')
})

const categoryDetailParamsSchema = v.object({
  slug: trimmedNonEmptyStringSchema
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

function validateCategoryDetailParams(params: unknown) {
  return v.parse(categoryDetailParamsSchema, params)
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
  itemDetailParamsSchema,
  itemsListQuerySchema,
  limitQuerySchema,
  nonEmptyStringSchema,
  pageQuerySchema,
  positiveIntegerIdParamSchema,
  redirectTargetQuerySchema,
  trimmedNonEmptyStringSchema,
  trimmedStringSchema,
  twitchOAuthBodySchema,
  validateBrandDetailParams,
  validateBrandIdParams,
  validateBrandMutationBody,
  validateBrandsListQuery,
  validateCategoryDetailParams,
  validateItemDetailParams,
  validateItemsListQuery,
  validateRedirectTargetQuery,
  validateTwitchOAuthBody
}
