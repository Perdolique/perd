import { and, asc, eq } from 'drizzle-orm'

interface EquipmentItem {
  id: number;
  name: string;
  weight: number;
  createdAt: Date;
}

export default defineEventHandler(async (event) : Promise<EquipmentItem[]> => {
  const userId = await validateSessionUser(event)

  const result = await event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name,
      weight: tables.equipment.weight,
      createdAt: tables.equipment.createdAt
    })
    .from(tables.equipment)
    .innerJoin(
      tables.userEquipment,
      and(
        eq(tables.userEquipment.userId, userId),
        eq(tables.userEquipment.equipmentId, tables.equipment.id)
      )
    )
    .orderBy(asc(tables.equipment.name))
    .limit(100)

  return result
})
