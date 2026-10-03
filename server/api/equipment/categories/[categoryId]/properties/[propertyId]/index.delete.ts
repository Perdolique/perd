import { defineEventHandler, getValidatedQuery, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'
import { validateCategoryPropertyParams, validateCategoryPropertyDeleteQuery } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validateCategoryPropertyParams)
  const query = await getValidatedQuery(event, validateCategoryPropertyDeleteQuery)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
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
