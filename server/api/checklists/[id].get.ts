import { and, eq } from 'drizzle-orm'
import { validateId } from '~~/server/utils/validate';

interface ReturnData {
  readonly id: string;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const userId = await getSessionUser(event)
  const id = getRouterParam(event, 'id')
  const checklistId = validateId(id)

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
