import { defineEventHandler, createError, readValidatedBody, setResponseStatus } from 'h3'
import { validateSessionUser, idValidatorNumber } from '#server/utils/validate'
import { tables } from '#server/utils/database'
import * as v from 'valibot'

const bodySchema = v.object({
  equipmentId: idValidatorNumber
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const userId = await validateSessionUser(event)
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
      status: 400,
      message: 'Cannot assign equipment to user'
    })
  }
})
