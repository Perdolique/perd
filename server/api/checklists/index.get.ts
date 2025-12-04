interface ReturnData {
  readonly id: string;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const userId = await validateSessionUser(event)

  const result = await event.context.db.query.checklists
    .findMany({
      columns: {
        id: true,
        name: true
      },

      orderBy: {
        createdAt: 'desc'
      },

      where: {
        userId
      },

      limit: 100
    })

  return result
})
