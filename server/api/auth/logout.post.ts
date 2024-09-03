export default defineEventHandler(async (event) => {
  await clearAppSession(event)

  sendNoContent(event)
})
