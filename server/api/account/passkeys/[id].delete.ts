import { defineEventHandler, setResponseStatus } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import { changePasskey, withPasskeyDatabase } from '#server/utils/auth/passkey-persistence'

import {
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { validatePasskeyIdParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<void> => {
  await handlePasskeyRequest(event, 'management', async (sensitiveValues) => {
    const config = getPasskeyConfig()

    validatePasskeyRequest(event, config)

    const { actor } = await getPasskeyActor(event, 'management')
    const { id } = await getValidatedRouteParams(event, validatePasskeyIdParams)

    await withPasskeyDatabase(sensitiveValues, async database => changePasskey(database, actor, {
      action: 'remove',
      id
    }))
  })

  setResponseStatus(event, 204)
})
