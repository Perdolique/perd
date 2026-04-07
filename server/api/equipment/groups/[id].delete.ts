import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { groupBaseSelection } from '#server/utils/equipment/base-records'
import { validateGroupIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouterParams(event, validateGroupIdParams)
  const dbWebsocket = createWebSocketClientFromEvent(event)

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
    if (isError(error)) {
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
