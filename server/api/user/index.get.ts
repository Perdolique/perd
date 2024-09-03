export default defineEventHandler(async (event) => {
  return await getSessionUser(event)
})
