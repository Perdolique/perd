import type { InferInput } from 'valibot'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { readMyGear, type MyGearRecord } from '#server/utils/my-gear'
import { throwMyGearError } from '#server/utils/my-gear-errors'

import {
  validateUserEquipmentIdParams,
  validateUserEquipmentUpdateBody,
  type userEquipmentUpdateBodySchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof userEquipmentUpdateBodySchema>; }>): Promise<MyGearRecord> => {
  const userId = await validateSessionUser(event)
  const { id } = await getValidatedRouteParams(event, validateUserEquipmentIdParams)
  const body = await readValidatedBody(event, validateUserEquipmentUpdateBody)
  const conditions = [eq(userEquipment.id, id), eq(userEquipment.userId, userId)]

  if (body.customName !== undefined) {
    conditions.push(isNull(userEquipment.itemId))
  } else if (body.personalName !== undefined) {
    conditions.push(isNotNull(userEquipment.itemId))
  }

  try {
    const [updated] = await event.context.dbHttp
      .update(userEquipment)
      .set(body)
      .where(
        and(...conditions)
      )
      .returning({ id: userEquipment.id })

    if (updated === undefined) {
      throw createError({ status: 404 })
    }

    const [record] = await readMyGear(event.context.dbHttp, userId, updated.id)

    if (record === undefined) {
      throw createError({ status: 404 })
    }

    return record
  } catch (error) {
    throwMyGearError(error, 'update')
  }
})
