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
      statusCode: 500,
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
