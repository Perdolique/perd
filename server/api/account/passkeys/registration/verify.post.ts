import { defineEventHandler } from 'h3'
import type { PasskeySummary } from '#shared/types/passkey'
import { readLimitedValidatedJsonBody } from '#server/utils/auth/email-authentication-request'
import { consumePasskeyChallenge } from '#server/utils/auth/passkey-challenges'
import { savePasskeyRegistration, withPasskeyDatabase } from '#server/utils/auth/passkey-persistence'

import {
  enforcePasskeyRateLimit,
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { addPasskeySensitiveValues, verifyPasskeyRegistration } from '#server/utils/auth/passkey-verification'
import { validatePasskeyRegistration } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<PasskeySummary> => handlePasskeyRequest(event, 'registration', async (sensitiveValues) => {
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)

    const { actor } = await getPasskeyActor(event, 'registration')

    await enforcePasskeyRateLimit(event, `registration:verify:user:${actor.userId}`)

    const body = await readLimitedValidatedJsonBody(event, 65_536, validatePasskeyRegistration)

    addPasskeySensitiveValues(body.credential, sensitiveValues)

    const challenge = await consumePasskeyChallenge(event.context.dbHttp, {
      actor,
      config,
      operation: 'registration',
      ceremonyId: body.ceremonyId
    })

    const registration = await verifyPasskeyRegistration(body.credential, challenge, sensitiveValues)

    return withPasskeyDatabase(event, sensitiveValues, async database => savePasskeyRegistration(database, {
      challenge,
      registration,
      sensitiveValues
    }))
}))
