import type { InferInput } from 'valibot'
import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { packingLists } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validatePackingListMutationBody, type packingListMutationBodySchema } from '#server/utils/validation/schemas'

interface PackingListSummary {
  createdAt: Date | string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof packingListMutationBodySchema>; }>) : Promise<PackingListSummary> => {
  const userId = await validateSessionUser(event)
  const { name } = await readValidatedBody(event, validatePackingListMutationBody)

  const [createdList] = await event.context.dbHttp
    .insert(packingLists)
    .values({
      name,
      userId
    })
    .returning({
      createdAt: packingLists.createdAt,
      id: packingLists.id,
      name: packingLists.name,
      updatedAt: packingLists.updatedAt
    })

  if (createdList === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create packing list'
    })
  }

  setResponseStatus(event, 201)

  return createdList
})
