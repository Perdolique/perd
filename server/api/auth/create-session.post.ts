export default defineEventHandler(async (event) => {
  const { db } = event.context

  // TODO (#101): check if user is already logged in

  const [{ userId }] = await db
    .insert(tables.users)
    .values({
      isAdmin: false
    })
    .returning({
      userId: tables.users.id,
      isAdmin: tables.users.isAdmin
    })

  const session = await useAppSession(event)

  setResponseStatus(event, 201)

  await session.update({
    userId
  })

  return {
    userId
  }
})
