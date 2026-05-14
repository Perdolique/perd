import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateSessionUser } from '#server/utils/session'
import { validatePackingListIdParams } from '#server/utils/validation/schemas'

interface PackingListSummary {
  createdAt: Date | string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export default defineEventHandler(async (event) : Promise<PackingListSummary> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)

  const packingList: PackingListSummary | undefined = await event.context.dbHttp.query.packingLists.findFirst({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      updatedAt: true
    },

    where: {
      id,
      userId
    }
  })

  if (packingList === undefined) {
    throw createError({ status: 404 })
  }

  return packingList
})
