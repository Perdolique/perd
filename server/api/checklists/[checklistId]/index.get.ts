import { and, eq } from 'drizzle-orm'

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

      where: and(
        eq(tables.checklists.userId, userId),
        eq(tables.checklists.id, checklistId)
      )
    })

  if (result === undefined) {
    throw createError({
      statusCode: 404
    })
  }

  return result
})
