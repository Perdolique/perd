import type { InferInput } from 'valibot'
import { and, eq, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'

import {
  validateUserEquipmentIdParams,
  validateUserEquipmentRenameBody,
  type userEquipmentRenameBodySchema
} from '#server/utils/validation/schemas'

import { throwMyGearError } from '#server/utils/my-gear-errors'
import type { CustomMyGearRecord } from './index.get'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof userEquipmentRenameBodySchema>; }>) : Promise<CustomMyGearRecord> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validateUserEquipmentIdParams)
  const { customName } = await readValidatedBody(event, validateUserEquipmentRenameBody)

  try {
    const [updated] = await event.context.dbHttp
      .update(userEquipment)
      .set({ customName })
      .where(
        and(
          eq(userEquipment.id, id),
          eq(userEquipment.userId, userId),
          isNull(userEquipment.itemId)
        )
      )
      .returning({
        id: userEquipment.id,
        createdAt: userEquipment.createdAt,
        customName: userEquipment.customName
      })

    if (updated?.customName === undefined || updated.customName === null) {
      throw createError({ status: 404 })
    }

    return {
      id: updated.id,
      createdAt: updated.createdAt,
      customName: updated.customName,
      source: 'custom'
    }
  } catch (error) {
    throwMyGearError(error, 'rename')
  }
})
