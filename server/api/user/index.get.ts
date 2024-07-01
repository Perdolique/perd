import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  let userIdToReturn : string | undefined;
  const session = await useAppSession(event)
  const { userId } = session.data

  // Check if the user in database
  if (userId !== undefined) {
    const users = await event.context.db
      .select({
        userId: tables.users.id
      })
      .from(tables.users)
      .where(
        eq(tables.users.id, userId)
      )
      .limit(1)

    if (users.length > 0) {
      userIdToReturn = userId
    }
  }

  return {
    userId: userIdToReturn
  }
})
