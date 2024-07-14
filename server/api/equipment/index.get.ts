import { desc, like } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    // TODO: replace to createError
    setResponseStatus(event, 401, 'Haha, you are not authorized')

    return
  }

  const { searchString } = getQuery(event)

  if (searchString === undefined || searchString === '') {
    const result = await event.context.db.query.equipment
      .findMany({
        orderBy: [desc(tables.equipment.createdAt)],
        limit: 10
      })

    return result
  }

  const result = await event.context.db.query.equipment
    .findMany({
      where: like(tables.equipment.name, `%${searchString}%`),
      limit: 10
    })

  return result
})
