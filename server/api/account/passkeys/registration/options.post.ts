import { defineEventHandler } from 'h3'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import type { PasskeyRegistrationOptions } from '#shared/types/passkey'
import { readLimitedValidatedJsonBody } from '#server/utils/auth/email-authentication-request'
import { issuePasskeyChallenge } from '#server/utils/auth/passkey-challenges'
import { preparePasskeyEnrollment, withPasskeyDatabase } from '#server/utils/auth/passkey-persistence'

import {
  enforcePasskeyRateLimit,
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { passkeyAlgorithms } from '#server/utils/auth/passkey-verification'
import { validatePasskeyName } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<PasskeyRegistrationOptions> => {
  const createdAt = new Date()

  return handlePasskeyRequest(event, 'registration', async (sensitiveValues) => {
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)

    const body = await readLimitedValidatedJsonBody(event, 1024, validatePasskeyName)
    const { actor } = await getPasskeyActor(event, 'registration')

    await enforcePasskeyRateLimit(event, `registration:options:user:${actor.userId}`)

    const enrollment = await withPasskeyDatabase(event, sensitiveValues, async database => preparePasskeyEnrollment(database, actor, sensitiveValues))
    const userID = isoBase64URL.toBuffer(enrollment.userHandle)
    const userName = enrollment.email ?? `Metsik ${enrollment.userHandle.slice(0, 8)}`

    const options = await generateRegistrationOptions({
      rpName: 'Metsik',
      rpID: config.rpId,
      userID,
      userName,
      userDisplayName: userName,
      timeout: 300_000,
      attestationType: 'none',
      supportedAlgorithmIDs: passkeyAlgorithms,

      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
      },

      excludeCredentials: enrollment.credentials
    })

    sensitiveValues.push(options.challenge)

    const ceremonyId = await issuePasskeyChallenge(event.context.dbHttp, {
      actor,
      config,
      operation: 'registration',
      challenge: options.challenge,
      createdAt,
      name: body.name
    })

    return {
      ceremonyId,
      options
    }
  })
})
