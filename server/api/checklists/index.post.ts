import * as v from 'valibot'
import { defineEventHandler, createError, readValidatedBody, setResponseStatus } from 'h3'
import { limits } from '~~/constants'
import { validateSessionUser } from '#server/utils/validate'
import { tables } from '#server/utils/database'

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxChecklistNameLength)
  )
})

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
      status: 400,
      message: 'Failed to create checklist'
    })
  }
})
