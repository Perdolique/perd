import type { InferInput } from 'valibot'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'

import {
  validateGroupIdParams,
  validateGroupMutationBody,
  type groupMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof groupMutationSchema>; }>): Promise<EquipmentGroupBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouteParams(event, validateGroupIdParams)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [updatedGroup] = await transaction
        .update(equipmentGroups)
        .set({
          name,
          slug
        })
        .where(
          eq(groupBaseSelection.id, groupId)
        )
        .returning(groupBaseSelection)

      if (updatedGroup === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'update_group',
          targetId: `${updatedGroup.id}`,

          metadata: {
            name: updatedGroup.name,
            slug: updatedGroup.slug
          }
        })

      return updatedGroup
    })
  } catch (error) {
    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to update group'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
