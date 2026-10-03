import { defineEventHandler, getValidatedRouterParams, readValidatedBody, setResponseStatus } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryPropertyParams,
  validatePropertyEnumOptionRevisionMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validateCategoryPropertyParams)
  const body = await readValidatedBody(event, validatePropertyEnumOptionRevisionMutationBody)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: body.expectedPropertiesRevision,
    userId
  }, {
    action: 'create_option',
    propertyId: params.propertyId,

    settings: {
      name: body.name,
      slug: body.slug
    }
  }))

  setResponseStatus(event, 201)

  return snapshot
})
