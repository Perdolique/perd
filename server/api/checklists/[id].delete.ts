import { and, eq } from 'drizzle-orm'
import { validateId } from '~~/server/utils/validate'

export default defineEventHandler(async (event) => {
  const userId = await getSessionUser(event)
  const id = getRouterParam(event, 'id')
  const checklistId = validateId(id)

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
