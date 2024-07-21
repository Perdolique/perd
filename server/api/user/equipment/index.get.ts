import { and, asc, eq, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    throw createError({
      statusCode: 401
    })
  }

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
      isNotNull(tables.userEquipment.userId)
    )
    .orderBy(asc(tables.equipment.name))
    .limit(100)

  return result
})
