import { asc, count, eq } from 'drizzle-orm'

interface ReturnData {
  readonly id: number;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const result = await event.context.db
    .select({
      id: tables.equipmentGroups.id,
      name: tables.equipmentGroups.name,
      equipmentCount: count(tables.equipment.id)
    })
    .from(tables.equipmentGroups)
    .leftJoin(
      tables.equipment,
      eq(tables.equipment.equipmentTypeId, tables.equipmentGroups.id)
    )
    .groupBy(tables.equipmentGroups.id)
    .orderBy(asc(tables.equipmentGroups.name))
    .limit(100)

  return result
})
