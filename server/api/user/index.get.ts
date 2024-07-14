import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  let userIdToReturn : string | undefined;
  const session = await useAppSession(event)
  const { userId } = session.data

  // Check if the user in database
  if (userId !== undefined) {
    const users = await event.context.db.query.users
      .findFirst({
        columns: {
          id: true
        },

        where: eq(tables.users.id, userId)
      })

    if (users?.id !== undefined) {
      userIdToReturn = userId
    }
  }

  return {
    userId: userIdToReturn
  }
})
