import { and, eq } from 'drizzle-orm';

interface ReturnData {
  readonly isAdmin: boolean;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    return {
      isAdmin: false
    };
  }

  const result = await event.context.db.query.users
    .findFirst({
      columns: {
        id: true
      },

      where: and(
        eq(tables.users.id, userId),
        eq(tables.users.isAdmin, true)
      )
    })

  const isAdmin = result?.id !== undefined

  return {
    isAdmin
  }
})
