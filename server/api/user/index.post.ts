export default defineEventHandler(async ({ context }) => {
  return await context.db
    .insert(tables.users)
    .values({})
    .returning();
})
