import { defineEventHandler } from 'h3'
import { readLimitedValidatedJsonBody } from '#server/utils/auth/email-authentication-request'
import { consumePasskeyChallenge } from '#server/utils/auth/passkey-challenges'
import { authenticatePasskey, withPasskeyDatabase } from '#server/utils/auth/passkey-persistence'

import {
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  limitPasskeyAuthentication,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { addPasskeySensitiveValues } from '#server/utils/auth/passkey-verification'
import { updateAppSession } from '#server/utils/session'
import type { SessionUser } from '#server/utils/user'
import { validatePasskeyAuthentication } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<SessionUser> => handlePasskeyRequest(event, 'authentication', async (sensitiveValues) => {
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)
    await limitPasskeyAuthentication(event, 'verify')

    const body = await readLimitedValidatedJsonBody(event, 65_536, validatePasskeyAuthentication)

    addPasskeySensitiveValues(body.credential, sensitiveValues)

    const { actor } = await getPasskeyActor(event, 'authentication')

    const challenge = await consumePasskeyChallenge(event.context.dbHttp, {
      actor,
      config,
      operation: 'authentication',
      ceremonyId: body.ceremonyId
    })

    const result = await withPasskeyDatabase(event, sensitiveValues, async database => authenticatePasskey(database, {
      challenge,
      response: body.credential,
      sensitiveValues
    }))

    await updateAppSession(event, {
      userId: result.user.userId,
      sessionVersion: result.sessionVersion
    })

    return result.user
}))
