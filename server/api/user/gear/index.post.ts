import type { InferInput } from 'valibot'
import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentCreateBody, type userEquipmentCreateBodySchema } from '#server/utils/validation/schemas'
import { readMyGear, type MyGearRecord } from '#server/utils/my-gear'
import { throwMyGearError } from '#server/utils/my-gear-errors'
import { normalizeDecimalNumber } from '#shared/utils/decimal-number'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof userEquipmentCreateBodySchema>; }>): Promise<MyGearRecord> => {
  const userId = await validateSessionUser(event)
  const body = await readValidatedBody(event, validateUserEquipmentCreateBody)

  try {
    if ('itemId' in body) {
      const approvedItem = await event.context.dbHttp.query.equipmentItems.findFirst({
        columns: {
          id: true
        },

        where: {
          id: body.itemId,
          status: 'approved'
        }
      })

      if (approvedItem === undefined) {
        throw createError({ status: 404 })
      }
    }

    const values = 'customName' in body
      ? {
          userId,
          customName: body.customName,
          note: body.note,
          measuredWeightGrams: body.measuredWeightGrams,
          ownedQuantity: body.ownedQuantity
        }
      : {
        userId,
        itemId: body.itemId
      }

    const [created] = await event.context.dbHttp
      .insert(userEquipment)
      .values(values)
      .returning({
        id: userEquipment.id,
        createdAt: userEquipment.createdAt,
        customName: userEquipment.customName,
        note: userEquipment.note,
        measuredWeightGrams: userEquipment.measuredWeightGrams,
        ownedQuantity: userEquipment.ownedQuantity
      })

    if (created === undefined) {
      throw createError({
        status: 500,
        message: 'Failed to create my gear row'
      })
    }

    if (created.customName !== null) {
      const measuredWeightGrams = created.measuredWeightGrams === null
        ? null
        : normalizeDecimalNumber(created.measuredWeightGrams)

      const record: MyGearRecord = {
        id: created.id,
        createdAt: created.createdAt,
        customName: created.customName,
        note: created.note,
        measuredWeightGrams,
        ownedQuantity: created.ownedQuantity,
        source: 'custom'
      }

      setResponseStatus(event, 201)

      return record
    }

    const [record] = await readMyGear(event.context.dbHttp, userId, created.id)

    if (record === undefined) {
      throw createError({
        status: 500,
        message: 'Failed to load created my gear row'
      })
    }

    setResponseStatus(event, 201)

    return record
  } catch (error) {
    throwMyGearError(error, 'create')
  }
})
