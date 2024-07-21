import { and, asc, eq, isNull, like } from 'drizzle-orm'

interface ReturnData {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly createdAt: Date;
}

export default defineEventHandler(async (event) : Promise<ReturnData[]> => {
  const session = await useAppSession(event)
  const { userId } = session.data
  const { searchString, filterOwned } = getQuery(event)

  if (userId === undefined || typeof searchString !== 'string' || searchString === '') {
    return []
  }

  if (Boolean(filterOwned) === true) {
    const result = await event.context.db
      .select({
        id: tables.equipment.id,
        name: tables.equipment.name,
        weight: tables.equipment.weight,
        createdAt: tables.equipment.createdAt
      })
      .from(tables.equipment)
      .leftJoin(
        tables.userEquipment,
        and(
          eq(tables.userEquipment.userId, userId),
          eq(tables.userEquipment.equipmentId, tables.equipment.id)
        )
      )
      .where(
        and(
          like(tables.equipment.name, `%${searchString}%`),
          isNull(tables.userEquipment.userId),
        )
      )
      .orderBy(asc(tables.equipment.name))
      .limit(100)

    return result
  }

  const result = await event.context.db.query.equipment
    .findMany({
      orderBy: [asc(tables.equipment.name)],
      where: like(tables.equipment.name, `%${searchString}%`),
      limit: 100
    })

  return result
})
