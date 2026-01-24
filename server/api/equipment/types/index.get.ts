import { asc, count, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { tables } from '#server/utils/database'

interface ReturnData {
  readonly id: number;
  readonly name: string;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const result = await event.context.db
    .select({
      id: tables.equipmentTypes.id,
      name: tables.equipmentTypes.name,
      equipmentCount: count(tables.equipment.id)
    })
    .from(tables.equipmentTypes)
    .leftJoin(
      tables.equipment,
      eq(tables.equipment.equipmentTypeId, tables.equipmentTypes.id)
    )
    .groupBy(tables.equipmentTypes.id)
    .orderBy(asc(tables.equipmentTypes.name))
    .limit(100)

  return result
})
