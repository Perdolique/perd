import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'h3'
import { contributions, equipmentGroups } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { groupBaseSelection, type EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
import { validateGroupMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateGroupMutationBody)

  let createdGroupRows: EquipmentGroupBaseRecord[] = []

  try {
    createdGroupRows = await dbHttp
      .insert(equipmentGroups)
      .values({
        name,
        slug
      })
      .returning(groupBaseSelection)
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to create group'
    })
  }

  const [createdGroup] = createdGroupRows

  if (createdGroup === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create group'
    })
  }

  await dbHttp
    .insert(contributions)
    .values({
      userId,
      action: 'create_group',
      targetId: `${createdGroup.id}`,

      metadata: {
        name: createdGroup.name,
        slug: createdGroup.slug
      }
    })

  setResponseStatus(event, 201)

  return createdGroup
})
