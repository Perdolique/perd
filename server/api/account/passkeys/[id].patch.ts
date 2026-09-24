import { defineEventHandler, getValidatedRouterParams } from 'h3'
import type { PasskeySummary } from '#shared/types/passkey'
import { readLimitedValidatedJsonBody } from '#server/utils/auth/email-authentication-request'
import { changePasskey, withPasskeyDatabase } from '#server/utils/auth/passkey-persistence'

import {
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { validatePasskeyIdParams, validatePasskeyName } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<PasskeySummary> => handlePasskeyRequest(event, 'management', async (sensitiveValues) => {
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)

    const { actor } = await getPasskeyActor(event, 'management')
    const { id } = await getValidatedRouterParams(event, validatePasskeyIdParams)
    const { name } = await readLimitedValidatedJsonBody(event, 1024, validatePasskeyName)

    return withPasskeyDatabase(event, sensitiveValues, async database => changePasskey(database, actor, {
      action: 'rename',
      id,
      name
    }))
}))
