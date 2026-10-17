import { defineEventHandler } from 'nuxt/server'
import { readMyGear, type MyGearRecord } from '#server/utils/my-gear'
import { throwMyGearError } from '#server/utils/my-gear-errors'
import { validateSessionUser } from '#server/utils/session'

export default defineEventHandler(async (event): Promise<MyGearRecord[]> => {
  const userId = await validateSessionUser(event)

  try {
    return await readMyGear(event.context.dbHttp, userId)
  } catch (error) {
    throwMyGearError(error, 'load')
  }
})
