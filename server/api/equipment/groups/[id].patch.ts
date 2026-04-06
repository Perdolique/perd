import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { createWebSocketClient } from '#server/utils/database'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'

import {
  validateGroupIdParams,
  validateGroupMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouterParams(event, validateGroupIdParams)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const dbWrite = createWebSocketClient(databaseConfig)

  try {
    return await dbWrite.transaction(async (transaction) => {
      const updatedGroupRows: EquipmentGroupBaseRecord[] = await transaction
        .update(equipmentGroups)
        .set({
          name,
          slug
        })
        .where(
          eq(groupBaseSelection.id, groupId)
        )
        .returning(groupBaseSelection)

      const [updatedGroup] = updatedGroupRows

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
    await dbWrite.$client.end()
  }
})
