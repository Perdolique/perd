import { and, eq } from 'drizzle-orm'
import { createError } from 'nuxt/server'
import { packingLists } from '#server/database/schema'
import type { createWebSocketClient } from '#server/utils/database'

type PackingListWriteDatabase = ReturnType<typeof createWebSocketClient>
type PackingListTransaction = Parameters<Parameters<PackingListWriteDatabase['transaction']>[0]>[0]

/** All entry writers lock the parent first, so resets and entry changes have one order. */
async function lockPackingList(transaction: PackingListTransaction, id: string, userId: string) {
  const [list] = await transaction
    .select({
      id: packingLists.id,
      updatedAt: packingLists.updatedAt
    })
    .from(packingLists)
    .where(
      and(
        eq(packingLists.id, id),
        eq(packingLists.userId, userId)
      )
    )
    .for('update')

  if (list === undefined) {
    throw createError({ status: 404 })
  }

  return list
}

/** Call after the lock. Versions must increase at the JSON timestamp's millisecond precision. */
function nextPackingListUpdatedAt(previous: Date): Date {
  const milliseconds = Math.max(Date.now(), previous.getTime() + 1)

  return new Date(milliseconds)
}

async function closePackingListWriteClient(database: PackingListWriteDatabase): Promise<void> {
  try {
    await database.$client.end()
  } catch (error) {
    console.error('Failed to close packing list database client', error)
  }
}

export { closePackingListWriteClient, lockPackingList, nextPackingListUpdatedAt }
