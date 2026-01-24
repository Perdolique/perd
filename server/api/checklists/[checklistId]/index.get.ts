import { defineEventHandler, createError, getRouterParam } from 'h3'
import { validateSessionUser, validateIdString } from '#server/utils/validate';

interface ReturnData {
  readonly id: string;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const userId = await validateSessionUser(event)
  const checklistIdParam = getRouterParam(event, 'checklistId')
  const checklistId = validateIdString(checklistIdParam)

  const result = await event.context.db.query.checklists
    .findFirst({
      columns: {
        id: true,
        name: true
      },

      where: {
        userId,
        id: checklistId
      }
    })

  if (result === undefined) {
    throw createError({
      status: 404
    })
  }

  return result
})
