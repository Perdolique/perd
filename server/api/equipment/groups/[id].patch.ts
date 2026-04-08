import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { groupBaseSelection } from '#server/utils/equipment/base-records'

import {
  validateGroupIdParams,
  validateGroupMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouterParams(event, validateGroupIdParams)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

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
    if (isError(error)) {
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
