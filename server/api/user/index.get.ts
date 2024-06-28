export default defineEventHandler(async () => {
  return await useDrizzle()
    .select()
    .from(tables.users)
    .all();
})