import { and, asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await validateSessionUser(event)
  const checklistIdParam = getRouterParam(event, 'id')
  const checklistId = validateId(checklistIdParam)

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
