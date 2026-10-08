import type { InferInput } from 'valibot'
import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryPropertyParams,
  validateCategoryPropertyDeleteQuery,
  type categoryPropertyDeleteQuerySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ query: InferInput<typeof categoryPropertyDeleteQuerySchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouteParams(event, validateCategoryPropertyParams)
  const query = await getValidatedQuery(event, validateCategoryPropertyDeleteQuery)

  const snapshot = await withPropertiesTransaction(async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: query.expectedPropertiesRevision,
    userId
  }, {
    action: 'delete',
    propertyId: params.propertyId,
    expectedAffectedItemCount: query.expectedAffectedItemCount
  }))

  return snapshot
})
