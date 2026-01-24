import * as v from 'valibot'
import { defineEventHandler, createError, getRouterParam, readValidatedBody, setResponseStatus } from 'h3'
import { validateSessionUser, validateIdString, idValidatorNumber } from '#server/utils/validate'
import { tables } from '#server/utils/database'

interface ReturnEquipment {
  id: number;
  name: string;
  weight: number;
}

interface ReturnData {
  id: number;
  equipment: ReturnEquipment;
}

const bodySchema = v.object({
  equipmentId: idValidatorNumber
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) : Promise<ReturnData | undefined> => {
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
        status: 500,
        message: 'Failed to create checklist item'
      })
    }

    const insertedItem = await db.query.checklistItems.findFirst({
      where: {
        id: foundItem.itemId
      },

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
      status: 400,
      message: 'Failed to create checklist item'
    })
  }
})
