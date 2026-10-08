import type { InferInput } from 'valibot'

import {
  createError,
  defineEventHandler,
  getValidatedRouterParams,
  isError,
  readValidatedBody,
  setResponseStatus,
  type H3Event
} from 'h3'

import { createWebSocketClientFromEvent } from '#server/utils/config'
import { copyPackingList, type PackingListCopySummary } from '#server/utils/packing-list-copy'
import { validateSessionUser } from '#server/utils/session'

import {
  validatePackingListIdParams,
  validatePackingListMutationBody,
  type packingListMutationBodySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof packingListMutationBodySchema>; }>): Promise<PackingListCopySummary> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouterParams(event, validatePackingListIdParams)
  const { name } = await readValidatedBody(event, validatePackingListMutationBody)
  let database: ReturnType<typeof createWebSocketClientFromEvent> | null = null

  try {
    database = createWebSocketClientFromEvent(event)

    const copy = await copyPackingList(database, {
      userId,
      id,
      name
    })

    setResponseStatus(event, 201)

    return copy
  } catch (error) {
    if (isError(error) && error.statusCode < 500) {
      throw error
    }

    console.error('Failed to copy packing list', error)

    let current = error

    for (let depth = 0; depth < 4 && current !== null && typeof current === 'object'; depth += 1) {
      const code: unknown = Reflect.get(current, 'code')

      if (code === '40001' || code === '40P01' || code === '23503') {
        throw createError({
          status: 409,
          message: 'The original list changed. Refresh it before trying again.'
        })
      }

      current = Reflect.get(current, 'cause')
    }

    throw createError({
      status: 500,
      message: 'Could not copy the list. Try again.'
    })
  } finally {
    try {
      await database?.$client.end()
    } catch (error) {
      console.error('Failed to close packing list copy client', error)
    }
  }
})
