import * as v from 'valibot'

const bodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  weight: v.number()
})

type BodyData = v.InferOutput<typeof bodySchema>

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readValidatedBody(event, validateBody)
  const { name, weight } = body
  const isAdmin = await checkAdmin(event, { force: true })

  if (isAdmin === false) {
    throw createError({
      statusCode: 403
    })
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
