import type { AnyColumn, SQL } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import type { packingLists } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'

interface PackingListSummary {
  createdAt: Date | string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export default defineEventHandler(async (event) : Promise<PackingListSummary[]> => {
  const userId = await validateSessionUser(event)

  const rows: PackingListSummary[] = await event.context.dbHttp.query.packingLists.findMany({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      updatedAt: true
    },

    where: {
      userId
    },

    orderBy: (lists: typeof packingLists, { desc }: { desc: (column: AnyColumn) => SQL }) => [
      desc(lists.createdAt),
      desc(lists.id)
    ]
  })

  return rows
})
