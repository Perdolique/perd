import type { InferInput } from 'valibot'
import { defineEventHandler, getValidatedRouterParams, readValidatedBody, type H3Event } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validatePropertyEnumOptionParams,
  validatePropertyEnumOptionRevisionMutationBody,
  type propertyEnumOptionRevisionMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof propertyEnumOptionRevisionMutationSchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouterParams(event, validatePropertyEnumOptionParams)
  const body = await readValidatedBody(event, validatePropertyEnumOptionRevisionMutationBody)

  const snapshot = await withPropertiesTransaction(event, async (transaction) => mutateCategoryProperties(transaction, {
    categoryId: params.categoryId,
    expectedPropertiesRevision: body.expectedPropertiesRevision,
    userId
  }, {
    action: 'update_option',
    propertyId: params.propertyId,
    optionId: params.optionId,

    settings: {
      name: body.name,
      slug: body.slug
    }
  }))

  return snapshot
})
