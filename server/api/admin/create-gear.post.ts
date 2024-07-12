export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readBody(event)
  const { name, weight } = body
  const isAdmin = await checkAdmin(event, { force: true })

  if (isAdmin === false) {
    setResponseStatus(event, 403, 'Go away, you are not an admin!')

    return
  }

  const [{ gearId }] = await db
    .insert(tables.gears)
    .values({
      name,
      weight
    })
    .returning({
      gearId: tables.gears.id
    })

  return {
    gearId
  }
})
