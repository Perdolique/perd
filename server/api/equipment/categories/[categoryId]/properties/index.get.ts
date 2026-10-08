import { defineEventHandler } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { validateAdminUser } from '#server/utils/admin'

import {
  readCategoryPropertiesSnapshot,
  type AdminCategoryPropertiesSnapshot
} from '#server/utils/equipment/category-properties'

import { withPropertiesTransaction } from '#server/utils/equipment/properties-request'
import { validateCategoryScopedParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<AdminCategoryPropertiesSnapshot> => {
  await validateAdminUser(event)

  const { categoryId } = await getValidatedRouteParams(event, validateCategoryScopedParams)

  return withPropertiesTransaction(async (transaction) => readCategoryPropertiesSnapshot(transaction, categoryId), true)
})
