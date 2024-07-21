export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readBody(event)
  const isRequestAdmin = body?.isAdmin === true

  const [{ userId, isAdmin }] = await db
    .insert(tables.users)
    .values({
      isAdmin: isRequestAdmin
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
    userId,
    isAdmin
  }
})
