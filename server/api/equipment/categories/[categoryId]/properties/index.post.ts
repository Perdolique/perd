import type { InferInput } from 'valibot'
import { defineEventHandler, getValidatedRouterParams, readValidatedBody, setResponseStatus, type H3Event } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryScopedParams,
  validateCategoryPropertyMutationBody,
  type categoryPropertyMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof categoryPropertyMutationSchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validateCategoryScopedParams)
  const body = await readValidatedBody(event, validateCategoryPropertyMutationBody)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
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
