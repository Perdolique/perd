export default defineEventHandler(async () => {
  return await useDrizzle().insert(tables.users).values({}).returning();
})