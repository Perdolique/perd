import { createError, type RequestEvent } from 'nuxt/server'
import { useAppSession } from '#server/utils/session'

async function validateAdminUser(event: RequestEvent) {
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
