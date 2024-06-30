export default defineEventHandler(async ({ context }) => {
  return context.db.select()
    .from(tables.users)
    .all();
})
