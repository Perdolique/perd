import { and, eq } from 'drizzle-orm'

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
