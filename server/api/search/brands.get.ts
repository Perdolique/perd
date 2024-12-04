import { asc, ilike } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { search } = getQuery(event)

  if (typeof search !== 'string') {
    return []
  }

  const result = await event.context.db.query.brands.findMany({
    columns: {
      id: true,
      name: true
    },

    where: ilike(tables.brands.name, `%${search}%`),
    orderBy: asc(tables.brands.name),
    limit: 10
  })

  return result
})
