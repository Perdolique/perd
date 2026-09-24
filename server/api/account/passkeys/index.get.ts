import { createError, defineEventHandler } from 'h3'
import type { PasskeyListResponse } from '#shared/types/passkey'
import { getPasskeyActor, handlePasskeyRequest } from '#server/utils/auth/passkey-request'
import { listPasskeys } from '#server/utils/auth/passkey-persistence'

export default defineEventHandler(async (event): Promise<PasskeyListResponse> => handlePasskeyRequest(event, 'management', async () => {
    const { user } = await getPasskeyActor(event, 'management')

    if (user.userId === null) {
      throw createError({ status: 401 })
    }

    const items = await listPasskeys(event.context.dbHttp, user.userId)

    return {
      items,
      canRegister: user.email !== null || user.isTwitchLinked
    }
}))
