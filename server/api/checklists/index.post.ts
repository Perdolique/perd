import * as v from 'valibot'
import { limits } from '~~/constants'

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxChecklistNameLength)
  )
})

type BodyData = v.InferOutput<typeof bodySchema>

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const userId = await validateSessionUser(event)
  const body = await readValidatedBody(event, validateBody)
  const { name } = body

  try {
    await db
      .insert(tables.checklists)
      .values({
        userId,
        name
      })

    setResponseStatus(event, 201)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Failed to create checklist'
    })
  }
})
