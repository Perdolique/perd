import { eq } from 'drizzle-orm'
import * as v from 'valibot'

const bodySchema = v.object({
  equipmentId: idValidatorNumber
})

type BodyData = v.InferOutput<typeof bodySchema>

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context

  await validateSessionUser(event)

  const checklistIdParam = getRouterParam(event, 'checklistId')
  const checklistId = validateIdString(checklistIdParam)
  const { equipmentId } = await readValidatedBody(event, validateBody)

  try {
    const [foundItem] = await db
      .insert(tables.checklistItems)
      .values({
        checklistId,
        equipmentId
      })
      .returning({
        itemId: tables.checklistItems.id
      })

    if (foundItem === undefined) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create checklist item'
      })
    }

    const insertedItem = await db.query.checklistItems.findFirst({
      where: eq(tables.checklistItems.id, foundItem.itemId),

      columns: {
        id: true
      },

      with: {
        equipment: {
          columns: {
            id: true,
            name: true,
            weight: true
          }
        }
      }
    })

    setResponseStatus(event, 201)

    return insertedItem
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
