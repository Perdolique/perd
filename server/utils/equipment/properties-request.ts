import { createError, isError, type H3Event } from 'h3'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import type { PropertiesTransaction } from '#server/utils/equipment/category-properties'
import { logCategoryWriteError } from '#server/utils/equipment/category-write-errors'

/** Owns transaction cleanup and safe errors for characteristic reads and writes. */
async function withPropertiesTransaction<Result>(
  event: H3Event,
  operation: (transaction: PropertiesTransaction) => Promise<Result>,
  readOnly = false
): Promise<Result> {
  let database: ReturnType<typeof createWebSocketClientFromEvent> | null = null

  try {
    database = createWebSocketClientFromEvent(event)

    const configuration = readOnly ? {
      isolationLevel: 'repeatable read' as const,
      accessMode: 'read only' as const
    } : undefined

    return await database.transaction(operation, configuration)
  } catch (error) {
    if (isError(error) && error.statusCode < 500) {
      throw error
    }

    logCategoryWriteError('Failed to manage category characteristics', error)

    throw createError({
      status: 500,
      message: 'Could not load or save characteristics. Try again.'
    })
  } finally {
    try {
      await database?.$client.end()
    } catch (error) {
      logCategoryWriteError('Failed to close characteristics database client', error)
    }
  }
}

export { withPropertiesTransaction }
