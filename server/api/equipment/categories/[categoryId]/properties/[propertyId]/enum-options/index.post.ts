import type { InferInput } from 'valibot'
import { defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { validateAdminUser } from '#server/utils/admin'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'

import {
  validateCategoryPropertyParams,
  validatePropertyEnumOptionRevisionMutationBody,
  type propertyEnumOptionRevisionMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof propertyEnumOptionRevisionMutationSchema>; }>): Promise<AdminCategoryPropertiesSnapshot> => {
  const userId = await validateAdminUser(event)
  const params = await getValidatedRouteParams(event, validateCategoryPropertyParams)
  const body = await readValidatedBody(event, validatePropertyEnumOptionRevisionMutationBody)

  const snapshot = await withPropertiesTransaction(async (transaction) => mutateCategoryProperties(transaction, {
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
