import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, isNuxtError, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { groupBaseSelection } from '#server/utils/equipment/base-records'
import { validateGroupIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<void> => {
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouteParams(event, validateGroupIdParams)
  const dbWebsocket = createRuntimeWebSocketClient()

  try {
    await dbWebsocket.transaction(async (transaction) => {
      const [currentGroup] = await transaction
        .delete(equipmentGroups)
        .where(
          eq(groupBaseSelection.id, groupId)
        )
        .returning(groupBaseSelection)

      if (currentGroup === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'delete_group',
          targetId: `${currentGroup.id}`,

          metadata: {
            name: currentGroup.name,
            slug: currentGroup.slug
          }
        })
    })
  } catch (error) {
    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to delete group'
    })
  } finally {
    await dbWebsocket.$client.end()
  }

  setResponseStatus(event, 204)
})
