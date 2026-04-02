import { createError, type H3Event, type EventHandlerRequest } from 'h3'
import { useAppSession } from '#server/utils/session'

async function validateAdminUser(event: H3Event<EventHandlerRequest>) {
  const session = await useAppSession(event)
  const { userId, isAdmin } = session.data

  if (userId === undefined) {
    throw createError({
      status: 401
    })
  }

  if (isAdmin !== true) {
    throw createError({
      status: 403
    })
  }

  return userId
}

export { validateAdminUser }
