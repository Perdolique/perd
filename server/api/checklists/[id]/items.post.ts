import * as v from 'valibot'

const bodySchema = v.object({
  equipmentId: v.pipe(
    v.string(),
    v.nonEmpty()
  )
})

type BodyData = v.InferOutput<typeof bodySchema>

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context

  await validateSessionUser(event)

  const checklistIdParam = getRouterParam(event, 'id')
  const checklistId = validateId(checklistIdParam)
  const { equipmentId } = await readValidatedBody(event, validateBody)

  try {
    await db
      .insert(tables.checklistItems)
      .values({
        checklistId,
        equipmentId
      })

    setResponseStatus(event, 201)
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }

    throw createError({
      statusCode: 400,
      message: 'Failed to create checklist item'
    })
  }
})
