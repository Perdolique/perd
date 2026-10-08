import type { InferInput } from 'valibot'
import { defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryScopedParams,
  validateCategoryPropertyMutationBody,
  type categoryPropertyMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof categoryPropertyMutationSchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouteParams(event, validateCategoryScopedParams)
  const body = await readValidatedBody(event, validateCategoryPropertyMutationBody)

  const snapshot = await withPropertiesTransaction(async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: body.expectedPropertiesRevision,
    userId
  }, {
    action: 'create',
    settings: body
  }))

  setResponseStatus(event, 201)

  return snapshot
})
