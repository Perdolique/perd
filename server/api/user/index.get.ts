import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const defaultUser = {
    userId: null,
    isAdmin: false
  }

  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    return defaultUser
  }

  // Check if the user in database
  const users = await event.context.db.query.users
    .findFirst({
      columns: {
        id: true,
        isAdmin: true
      },

      where: eq(tables.users.id, userId)
    })

  if (users?.id === undefined) {
    return defaultUser
  }

  return {
    userId: users.id,
    isAdmin: users.isAdmin
  }
})
