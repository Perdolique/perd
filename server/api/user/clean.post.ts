export default defineEventHandler(async ({ context }) => {
  await context.db.delete(tables.users);
})
