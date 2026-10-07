import { and, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { packingListEntries, packingLists, userEquipment } from '#server/database/schema'
import type { createWebSocketClient } from '#server/utils/database'

type CopyDatabase = ReturnType<typeof createWebSocketClient>

interface PackingListCopyOptions {
  userId: string;
  id: string;
  name: string;
}

interface PackingListCopySummary {
  createdAt: Date;
  entryCount: number;
  id: string;
  name: string;
  packedCount: 0;
  updatedAt: Date;
}

/** Copies one owned snapshot atomically, keeping saved gear references shared. */
async function copyPackingList(database: CopyDatabase, options: PackingListCopyOptions): Promise<PackingListCopySummary> {
  const { userId, id, name } = options

  return database.transaction(async (transaction) => {
    const [original] = await transaction
      .select({
        id: packingLists.id
      })
      .from(packingLists)
      .where(
        and(
          eq(packingLists.id, id),
          eq(packingLists.userId, userId)
        )
      )
      .for('key share')

    if (original === undefined) {
      throw createError({ status: 404 })
    }

    const unavailable = await transaction
      .select({
        id: packingListEntries.id
      })
      .from(packingListEntries)
      .leftJoin(userEquipment, eq(packingListEntries.userEquipmentId, userEquipment.id))
      .where(
        and(
          eq(packingListEntries.packingListId, id),
          sql`${packingListEntries.userEquipmentId} is not null`,
          sql`(${userEquipment.id} is null or ${userEquipment.userId} <> ${userId})`
        )
      )
      .limit(1)

    if (unavailable.length > 0) {
      throw createError({
        status: 409,
        message: 'Saved gear is unavailable. Refresh the original list before trying again.'
      })
    }

    const [created] = await transaction.insert(packingLists).values({
      name,
      userId
    }).returning({
      createdAt: packingLists.createdAt,
      id: packingLists.id,
      name: packingLists.name,
      updatedAt: packingLists.updatedAt
    })

    if (created === undefined) {
      throw new Error('Packing list copy insert returned no row')
    }

    // PostgreSQL evaluates volatile output functions after sorting the source rows.
    const inserted = await transaction.execute(sql`
      INSERT INTO ${packingListEntries}
        ("id", "packingListId", "customName", "userEquipmentId", "isPacked", "createdAt", "updatedAt")
      SELECT uuidv7(), ${created.id}, "customName", "userEquipmentId", false, now(), now()
      FROM ${packingListEntries}
      WHERE "packingListId" = ${id}
      ORDER BY "createdAt", "id"
    `)

    if (inserted.rowCount === null) {
      throw new Error('Packing list copy insert returned no count')
    }

    return {
      createdAt: created.createdAt,
      entryCount: inserted.rowCount,
      id: created.id,
      name: created.name,
      packedCount: 0,
      updatedAt: created.updatedAt
    }
  }, { isolationLevel: 'repeatable read' })
}

export { copyPackingList }
export type { PackingListCopySummary }
