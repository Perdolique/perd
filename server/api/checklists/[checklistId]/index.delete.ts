import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const checklistIdParam = getRouterParam(event, 'checklistId')
  const checklistId = validateIdString(checklistIdParam)

  const deleted = await event.context.db
    .delete(tables.checklists)
    .where(
      and(
        eq(tables.checklists.userId, userId),
        eq(tables.checklists.id, checklistId)
      )
    )
    .returning({
      id: tables.checklists.id
    })

  if (deleted.length === 0) {
    throw createError({
      statusCode: 404
    })
  }

  setResponseStatus(event, 204)
})
