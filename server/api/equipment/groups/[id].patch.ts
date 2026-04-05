import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'

import {
  validateGroupIdParams,
  validateGroupMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouterParams(event, validateGroupIdParams)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)

  let updatedGroupRows: EquipmentGroupBaseRecord[] = []

  try {
    updatedGroupRows = await dbHttp
      .update(equipmentGroups)
      .set({
        name,
        slug
      })
      .where(
        eq(groupBaseSelection.id, groupId)
      )
      .returning(groupBaseSelection)
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to update group'
    })
  }

  const [updatedGroup] = updatedGroupRows

  if (updatedGroup === undefined) {
    throw createError({ status: 404 })
  }

  await dbHttp
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
