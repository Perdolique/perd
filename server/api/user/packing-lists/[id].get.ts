import { defineEventHandler } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { validatePackingListIdParams } from '#server/utils/validation/schemas'
import { validateSessionUser } from '#server/utils/session'
import { readPackingListDetail, type PackingListDetail } from '#server/utils/packing-list-detail'

export default defineEventHandler(async (event): Promise<PackingListDetail> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validatePackingListIdParams)

  return readPackingListDetail(event.context.dbHttp, id, userId)
})
