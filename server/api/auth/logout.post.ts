export default defineEventHandler(async (event) => {
  const session = await useAppSession(event)

  session.clear()

  sendNoContent(event)
})
