import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { groupBaseSelection } from '#server/utils/equipment/base-records'
import { validateGroupMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

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
    if (isError(error)) {
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
