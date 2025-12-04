interface ReturnType {
  id: number
  name: string
}

export default defineEventHandler(async (event) : Promise<ReturnType[]> => {
  const { search } = getQuery(event)

  if (typeof search !== 'string') {
    return []
  }

  const result = await event.context.db.query.brands.findMany({
    columns: {
      id: true,
      name: true
    },

    where: {
      name: {
        ilike: `%${search}%`
      }
    },

    orderBy: {
      name: 'asc'
    },

    limit: 10
  })

  return result
})
