import consola from 'consola'
import * as v from 'valibot'
import { limits } from '~~/constants'

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxEquipmentGroupNameLength)
  )
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const { name } = await readValidatedBody(event, validateBody)

  await validateAdmin(event)

  try {
    const [insertedGroup] = await db
      .insert(tables.equipmentGroups)
      .values({
        name
      })
      .returning({
        id: tables.equipmentGroups.id,
        name: tables.equipmentGroups.name
      })

    if (insertedGroup === undefined) {
      throw new Error('Failed to create equipment group')
    }

    setResponseStatus(event, 201)

    return insertedGroup
  } catch (error) {
    consola.error(error)

    throw createError({
      statusCode: 400,
      message: 'Failed to create equipment group'
    })
  }
})
