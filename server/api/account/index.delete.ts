import { and, eq } from 'drizzle-orm'
import { defineEventHandler, setResponseStatus } from 'h3'
import { validateSessionUser } from '#server/utils/validate'
import { tables } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)

  await event.context.db
    .delete(tables.users)
    .where(
      and(
        eq(tables.users.id, userId)
      )
    )

  setResponseStatus(event, 204)
})
