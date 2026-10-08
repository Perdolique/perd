import type { InferInput } from 'valibot'
import { defineEventHandler } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
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
import { validatePasskeyAuthentication, type passkeyAuthenticationSchema } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof passkeyAuthenticationSchema>; }>): Promise<SessionUser> => handlePasskeyRequest(event, 'authentication', async (sensitiveValues) => {
    const config = getPasskeyConfig()

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

    const result = await withPasskeyDatabase(sensitiveValues, async database => authenticatePasskey(database, {
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
