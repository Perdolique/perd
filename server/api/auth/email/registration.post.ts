import { defineEventHandler, createError, readValidatedBody, setResponseStatus } from 'h3'
import { emailRegistrationTurnstileAction } from '#shared/utils/turnstile'
import { validateEmailRegistration } from '#server/utils/validation/schemas'
import { getGuestClientIp } from '#server/utils/cloudflare'
import { verifyTurnstile } from '#server/utils/turnstile'
import { getEmailRegistrationConfig } from '#server/utils/config'

import {
  enforceEmailAuthenticationRateLimit,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { assertPasswordNotPwned } from '#server/utils/auth/pwned-passwords'
import { createVerificationToken, hashPassword, hashToken } from '#server/utils/auth/password'
import { getRegistrationActor, withRegistrationDatabase } from '#server/utils/auth/email-registration'
import { issueEmailRegistration } from '#server/utils/auth/email-registration-persistence'
import { sendRegistrationEmail } from '#server/utils/auth/email-registration-mail'

interface EmailRegistrationResponse {
  accepted: true;
}

export default defineEventHandler(async (event): Promise<EmailRegistrationResponse> => {
  const config = getEmailRegistrationConfig(event)

  validateEmailAuthenticationRequest(event, config.origin)

  const body = await readValidatedBody(event, validateEmailRegistration)
  const clientIp = getGuestClientIp(event, import.meta.dev === true)

  await verifyTurnstile(event, body['cf-turnstile-response'], {
    remoteIp: clientIp,
    expectedAction: emailRegistrationTurnstileAction
  })

  const emailHash = hashToken(body.email)

  await enforceEmailAuthenticationRateLimit(event, {
    deniedStatusMessage: 'Too many attempts. Try again in a minute',

    getBinding: () => {
      const binding = event.context.cloudflare?.env.EMAIL_REGISTRATION_RATE_LIMITER

      if (binding === undefined) {
        throw new Error('Missing binding EMAIL_REGISTRATION_RATE_LIMITER')
      }

      return binding
    },

    keys: [`ip:${clientIp}`, `email:${emailHash}`],
    logMessage: 'Email registration rate limit failed',
    unavailableStatusMessage: 'Email registration is temporarily unavailable'
  })

  if (config.stagingRecipient !== null && body.email !== config.stagingRecipient) {
    throw createError({
      status: 400,
      statusMessage: 'Use the configured staging email address'
    })
  }

  await assertPasswordNotPwned(body.password)

  const passwordHash = await hashPassword(body.password)
  const token = createVerificationToken()
  const tokenHash = hashToken(token)
  const sensitiveValues = [body.password, body.email, passwordHash, token, tokenHash]

  await withRegistrationDatabase(event, sensitiveValues, async (database) => {
    const actor = await getRegistrationActor(event)

    await issueEmailRegistration(database, {
      actor,
      email: body.email,
      passwordHash,
      tokenHash,
      redirectTo: body.redirectTo
    }, async (isExistingAccount) => {
      await sendRegistrationEmail(event, config, {
        email: body.email,
        token,
        isExistingAccount
      })
    })
  })

  setResponseStatus(event, 202)

  return { accepted: true }
})
