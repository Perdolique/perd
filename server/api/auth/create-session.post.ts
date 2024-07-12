export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readBody(event)
  const isAdmin = body?.isAdmin === true

  const [{ userId }] = await db
    .insert(tables.users)
    .values({
      isAdmin
    })
    .returning({
      userId: tables.users.id
    })

  const session = await useAppSession(event)

  await session.update({
    userId
  })

  return {
    userId
  }
})
