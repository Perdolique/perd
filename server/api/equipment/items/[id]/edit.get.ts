import { createError, defineEventHandler, getValidatedRouterParams, isError } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { logCategoryWriteError } from '#server/utils/equipment/category-write-errors'

import {
  readEquipmentItemEditSnapshot,
  type EquipmentItemEditResponse
} from '#server/utils/equipment/item-edit-snapshot'

import { validateItemDetailParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<EquipmentItemEditResponse> => {
  await validateAdminUser(event)

  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)

  try {
    return await readEquipmentItemEditSnapshot(event.context.dbHttp, id)
  } catch (error) {
    if (isError(error) && error.statusCode < 500) { throw error }

    logCategoryWriteError('Failed to load equipment item editor', error)

    throw createError({
      status: 500,
      message: 'Could not load the item. Try again.'
    })
  }
})
