import * as v from 'valibot'

const bodySchema = v.object({
  equipmentId: v.pipe(v.string(), v.nonEmpty()),
})

type BodyData = v.InferOutput<typeof bodySchema>

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    throw createError({
      statusCode: 401
    })
  }

  const body = await readValidatedBody(event, validateBody)
  const { equipmentId } = body

  try {
    await db
      .insert(tables.userEquipment)
      .values({
        userId,
        equipmentId
      })

    setResponseStatus(event, 201)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Cannot assign equipment to user'
    })
  }
})
