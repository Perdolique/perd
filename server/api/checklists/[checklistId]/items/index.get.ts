import { and, asc, eq } from 'drizzle-orm'
import { defineEventHandler, getRouterParam } from 'h3'
import { validateSessionUser, validateIdString } from '#server/utils/validate'
import { tables } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const checklistIdParam = getRouterParam(event, 'checklistId')
  const checklistId = validateIdString(checklistIdParam)

  const result = await event.context.db
    .select({
      id: tables.checklistItems.id,

      equipment: {
        id: tables.equipment.id,
        name: tables.equipment.name,
        weight: tables.equipment.weight
      }
    })
    .from(tables.checklistItems)
    .innerJoin(
      tables.checklists,
      and(
        eq(tables.checklistItems.checklistId, tables.checklists.id),
        eq(tables.checklistItems.checklistId, checklistId),
        eq(tables.checklists.userId, userId)
      )
    )
    .innerJoin(
      tables.equipment,
      eq(tables.checklistItems.equipmentId, tables.equipment.id)
    )
    .orderBy(asc(tables.equipment.name))
    .limit(100)

  return result
})
