export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readBody(event)
  const { name, weight } = body
  const isAdmin = await checkAdmin(event, { force: true })

  if (isAdmin === false) {
    setResponseStatus(event, 403, 'Go away, you are not an admin!')

    return
  }

  const [{ itemId }] = await db
    .insert(tables.equipment)
    .values({
      name,
      weight
    })
    .returning({
      itemId: tables.equipment.id
    })

  setResponseStatus(event, 201)

  return {
    itemId
  }
})
