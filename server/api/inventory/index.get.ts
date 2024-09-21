import { and, asc, eq, isNull, like } from 'drizzle-orm'

interface ReturnData {
  readonly id: number;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const userId = await validateSessionUser(event)
  const { search, checklistId } = getQuery(event)

  if (typeof search !== 'string' || typeof checklistId !== 'string') {
    return []
  }

  const result = await event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name
    })
    .from(tables.equipment)
    .innerJoin(
      tables.userEquipment,
      and(
        eq(tables.userEquipment.userId, userId),
        eq(tables.userEquipment.equipmentId, tables.equipment.id)
      )
    )
    .leftJoin(
      tables.checklistItems,
      and(
        eq(tables.checklistItems.equipmentId, tables.equipment.id),
        eq(tables.checklistItems.checklistId, checklistId)
      )
    )
    .where(
      and(
        isNull(tables.checklistItems.id),
        like(tables.equipment.name, `%${search}%`)
      )
    )
    .orderBy(
      asc(tables.equipment.name)
    )
    .limit(100)

  return result
})
