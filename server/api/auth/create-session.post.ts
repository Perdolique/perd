export default defineEventHandler(async ({ context }) => {
  const result = await context.db.transaction(async (tx) => {
    const user = await tx
      .insert(tables.users)
      .values({})
      .returning()

    // context.db.insert(tables.userSessions).values({
    //   session: 's1',
    //   userId: 'woof'
    // }).returning()
})

  return result
})
