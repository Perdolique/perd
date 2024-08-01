import { desc, eq } from 'drizzle-orm'

interface ReturnData {
  readonly id: string;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const userId = await getSessionUser(event)

  const result = await event.context.db.query.checklists
    .findMany({
      columns: {
        id: true,
        name: true
      },

      orderBy: [desc(tables.checklists.createdAt)],
      where: eq(tables.checklists.userId, userId),
      limit: 100
    })

  return result
})
