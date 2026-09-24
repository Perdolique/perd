import { defineEventHandler, getValidatedRouterParams, sendNoContent } from 'h3'
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
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)

    const { actor } = await getPasskeyActor(event, 'management')
    const { id } = await getValidatedRouterParams(event, validatePasskeyIdParams)

    await withPasskeyDatabase(event, sensitiveValues, async database => changePasskey(database, actor, {
      action: 'remove',
      id
    }))
  })

  sendNoContent(event)
})
