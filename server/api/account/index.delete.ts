import { eq } from 'drizzle-orm'
import { defineEventHandler, setResponseStatus } from 'nuxt/server'
import { validateSessionUser, clearAppSession } from '#server/utils/session'
import { users } from '#server/database/schema'

export default defineEventHandler(async (event): Promise<void> => {
  const userId = await validateSessionUser(event)

  await event.context.dbHttp
    .delete(users)
    .where(
      eq(users.id, userId)
    )

  await clearAppSession(event)
  setResponseStatus(event, 204)
})
