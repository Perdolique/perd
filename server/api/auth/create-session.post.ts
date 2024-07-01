export default defineEventHandler(async (event) => {
  const { db } = event.context

  const [{ userId }] = await db
    .insert(tables.users)
    .values({})
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
