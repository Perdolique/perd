import { defineEventHandler } from 'h3'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import type { PasskeyAuthenticationOptions } from '#shared/types/passkey'
import { readLimitedValidatedJsonBody } from '#server/utils/auth/email-authentication-request'
import { issuePasskeyChallenge } from '#server/utils/auth/passkey-challenges'

import {
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  limitPasskeyAuthentication,
  validatePasskeyRequest
} from '#server/utils/auth/passkey-request'

import { validatePasskeyOptions } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<PasskeyAuthenticationOptions> => {
  const createdAt = new Date()

  return handlePasskeyRequest(event, 'authentication', async (sensitiveValues) => {
    const config = getPasskeyConfig(event)

    validatePasskeyRequest(event, config)
    await limitPasskeyAuthentication(event, 'options')
    await readLimitedValidatedJsonBody(event, 1024, validatePasskeyOptions)

    const { actor } = await getPasskeyActor(event, 'authentication')

    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      userVerification: 'required',
      allowCredentials: [],
      timeout: 300_000
    })

    sensitiveValues.push(options.challenge)

    const ceremonyId = await issuePasskeyChallenge(event.context.dbHttp, {
      actor,
      config,
      operation: 'authentication',
      challenge: options.challenge,
      createdAt
    })

    return {
      ceremonyId,
      options
    }
  })
})
