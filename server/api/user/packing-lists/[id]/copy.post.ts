import type { InferInput } from 'valibot'
import { createError, defineEventHandler, isNuxtError, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { copyPackingList, type PackingListCopySummary } from '#server/utils/packing-list-copy'
import { validateSessionUser } from '#server/utils/session'

import {
  validatePackingListIdParams,
  validatePackingListMutationBody,
  type packingListMutationBodySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof packingListMutationBodySchema>; }>): Promise<PackingListCopySummary> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validatePackingListIdParams)
  const { name } = await readValidatedBody(event, validatePackingListMutationBody)
  let database: ReturnType<typeof createRuntimeWebSocketClient> | null = null

  try {
    database = createRuntimeWebSocketClient()

    const copy = await copyPackingList(database, {
      userId,
      id,
      name
    })

    setResponseStatus(event, 201)

    return copy
  } catch (error) {
    if (isNuxtError(error) && error.status < 500) {
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
