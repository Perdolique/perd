import { and, eq, exists } from 'drizzle-orm'
import * as v from 'valibot'
import { defineEventHandler, createError, getValidatedRouterParams, setResponseStatus } from 'h3'
import { validateSessionUser, idValidatorString, stringToIntegerValidator } from '#server/utils/validate'
import { tables } from '#server/utils/database'

const paramsSchema = v.object({
  checklistId: idValidatorString,
  itemId: stringToIntegerValidator
})

function validateParams(params: unknown) {
  return v.parse(paramsSchema, params)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const userId = await validateSessionUser(event)
  const { checklistId, itemId } = await getValidatedRouterParams(event, validateParams)

  const [deletedItem] = await db.delete(tables.checklistItems)
    .where(
      and(
        eq(tables.checklistItems.id, itemId),
        eq(tables.checklistItems.checklistId, checklistId),
        exists(
          db.select({
            id: tables.checklists.id
          })
            .from(tables.checklists)
            .where(
              and(
                eq(tables.checklists.id, checklistId),
                eq(tables.checklists.userId, userId)
              )
            )
          )
      )
    )
    .returning({
      id: tables.checklistItems.id
    })

  if (deletedItem === undefined) {
    throw createError({
      status: 404
    })
  }

  return deletedItem
})
