import type { InferInput } from 'valibot'
import { defineEventHandler, getValidatedQuery, getValidatedRouterParams, type H3Event } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validatePropertyEnumOptionParams,
  validatePropertiesRevisionQuery,
  type propertiesRevisionQuerySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: H3Event<{ query: InferInput<typeof propertiesRevisionQuerySchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validatePropertyEnumOptionParams)
  const query = await getValidatedQuery(event, validatePropertiesRevisionQuery)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: query.expectedPropertiesRevision,
    userId
  }, {
    action: 'delete_option',
    propertyId: params.propertyId,
    optionId: params.optionId
  }))

  return snapshot
})
