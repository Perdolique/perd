import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, setResponseStatus } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
import { validateGroupIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { id: groupId } = await getValidatedRouterParams(event, validateGroupIdParams)

  let deletedGroupRows: EquipmentGroupBaseRecord[] = []

  try {
    deletedGroupRows = await dbHttp
      .delete(equipmentGroups)
      .where(
        eq(groupBaseSelection.id, groupId)
      )
      .returning(groupBaseSelection)
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to delete group'
    })
  }

  const [currentGroup] = deletedGroupRows

  if (currentGroup === undefined) {
    throw createError({ status: 404 })
  }

  await dbHttp
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

  setResponseStatus(event, 204)
})
