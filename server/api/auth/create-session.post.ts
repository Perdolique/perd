import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { users } from '#server/database/schema'
import { useAppSession } from '#server/utils/session'

interface ReturnType {
  userId: string;
}

export default defineEventHandler(async (event) : Promise<ReturnType> => {
  const { dbHttp } = event.context

  // TODO (#101): check if user is already logged in

  const [newUser] = await dbHttp
    .insert(users)
    .values({})
    .returning({
      userId: users.id,
      isAdmin: users.isAdmin
    })

  if (newUser === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create user'
    })
  }

  const session = await useAppSession(event)

  setResponseStatus(event, 201)

  await session.update({
    userId: newUser.userId
  })

  return {
    userId: newUser.userId
  }
})
