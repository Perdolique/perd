import * as v from 'valibot'

const bodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  weight: v.number()
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readValidatedBody(event, validateBody)
  const { name, weight } = body

  await validateAdmin(event, {
    force: true
  })

  const [foundItem] = await db
    .insert(tables.equipment)
    .values({
      name,
      weight
    })
    .returning({
      itemId: tables.equipment.id
    })

  if (foundItem === undefined) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create equipment'
    })
  }

  setResponseStatus(event, 201)

  return {
    itemId: foundItem.itemId
  }
})
