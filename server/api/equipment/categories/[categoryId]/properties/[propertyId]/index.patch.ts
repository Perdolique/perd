import { defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'
import { validateCategoryPropertyParams, validateCategoryPropertyUpdateBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validateCategoryPropertyParams)
  const body = await readValidatedBody(event, validateCategoryPropertyUpdateBody)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
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
