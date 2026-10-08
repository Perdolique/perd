import type { InferInput } from 'valibot'
import { createError, defineEventHandler, isNuxtError, readValidatedBody, setResponseStatus } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
import { validateGroupMutationBody, type groupMutationSchema } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof groupMutationSchema>; }>): Promise<EquipmentGroupBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    const createdGroup = await dbWebsocket.transaction(async (transaction) => {
      const [newGroup] = await transaction
        .insert(equipmentGroups)
        .values({
          name,
          slug
        })
        .returning(groupBaseSelection)

      if (newGroup === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create group'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'create_group',
          targetId: `${newGroup.id}`,

          metadata: {
            name: newGroup.name,
            slug: newGroup.slug
          }
        })

      return newGroup
    })

    setResponseStatus(event, 201)

    return createdGroup
  } catch (error) {
    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to create group'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
