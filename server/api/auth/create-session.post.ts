import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { tables } from '#server/utils/database'
import { useAppSession } from '#server/utils/session';

interface ReturnType {
  userId: string;
}

export default defineEventHandler(async (event) : Promise<ReturnType> => {
  const { db } = event.context

  // TODO (#101): check if user is already logged in

  const [foundUser] = await db
    .insert(tables.users)
    .values({
      isAdmin: false
    })
    .returning({
      userId: tables.users.id,
      isAdmin: tables.users.isAdmin
    })

  if (foundUser === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create user'
    })
  }

  const session = await useAppSession(event)

  setResponseStatus(event, 201)

  await session.update({
    userId: foundUser.userId
  })

  return {
    userId: foundUser.userId
  }
})
