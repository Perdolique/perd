import consola from 'consola'
import * as v from 'valibot'
import { limits } from '~~/constants'

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxEquipmentTypeNameLength)
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
    const [insertedType] = await db
      .insert(tables.equipmentTypes)
      .values({
        name
      })
      .returning({
        id: tables.equipmentTypes.id,
        name: tables.equipmentTypes.name
      })

    if (insertedType === undefined) {
      throw new Error('Failed to create equipment type')
    }

    setResponseStatus(event, 201)

    return insertedType
  } catch (error) {
    consola.error(error)

    throw createError({
      statusCode: 400,
      message: 'Failed to create equipment type'
    })
  }
})
