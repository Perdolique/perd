export default defineEventHandler(async () => {
  await useDrizzle().delete(tables.users);
})