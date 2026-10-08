import type { InferInput } from 'valibot'
import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryPropertyParams,
  validateCategoryPropertyUpdateBody,
  type categoryPropertyUpdateSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof categoryPropertyUpdateSchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouteParams(event, validateCategoryPropertyParams)
  const body = await readValidatedBody(event, validateCategoryPropertyUpdateBody)

  const snapshot = await withPropertiesTransaction(async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: body.expectedPropertiesRevision,
    userId
  }, {
    action: 'update',
    propertyId: params.propertyId,
    settings: body
  }))

  return snapshot
})
