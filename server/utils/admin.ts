import { createError, type H3Event, type EventHandlerRequest } from 'h3'
import { useAppSession } from '#server/utils/session'

async function validateAdminUser(event: H3Event<EventHandlerRequest>) {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    throw createError({
      status: 401
    })
  }

  const foundUser = await event.context.dbHttp.query.users.findFirst({
    columns: {
      isAdmin: true
    },

    where: {
      id: userId
    }
  })

  if (foundUser === undefined) {
    throw createError({
      status: 401
    })
  }

  if (foundUser.isAdmin !== true) {
    throw createError({
      status: 403
    })
  }

  return userId
}

export { validateAdminUser }
