import { defineEventHandler, readValidatedBody } from 'h3'
import { validateEmailVerification } from '#server/utils/validation/schemas'
import { getGuestClientIp } from '#server/utils/cloudflare'
import { updateAppSession } from '#server/utils/session'
import type { SessionUser } from '#server/utils/user'
import { getEmailRegistrationConfig } from '#server/utils/config'

import {
  enforceEmailAuthenticationRateLimit,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { hashToken } from '#server/utils/auth/password'
import { getRegistrationActor, withRegistrationDatabase } from '#server/utils/auth/email-registration'
import { completeEmailRegistration } from '#server/utils/auth/email-registration-persistence'

interface EmailVerificationResponse {
  user: SessionUser;
  redirectTo: string;
}

export default defineEventHandler(async (event): Promise<EmailVerificationResponse> => {
  const config = getEmailRegistrationConfig(event)

  validateEmailAuthenticationRequest(event, config.origin)

  const body = await readValidatedBody(event, validateEmailVerification)
  const clientIp = getGuestClientIp(event, import.meta.dev === true)
  const tokenHash = hashToken(body.token)

  await enforceEmailAuthenticationRateLimit(event, {
    deniedStatusMessage: 'Too many attempts. Try again in a minute',

    getBinding: () => {
      const binding = event.context.cloudflare?.env.EMAIL_VERIFICATION_RATE_LIMITER

      if (binding === undefined) {
        throw new Error('Missing binding EMAIL_VERIFICATION_RATE_LIMITER')
      }

      return binding
    },

    keys: [`ip:${clientIp}`, `token:${tokenHash}`],
    logMessage: 'Email registration rate limit failed',
    unavailableStatusMessage: 'Email registration is temporarily unavailable'
  })

  const sensitiveValues = [body.password, body.token, tokenHash]

  const result = await withRegistrationDatabase(event, sensitiveValues, async (database) => {
    const actor = await getRegistrationActor(event)

    return completeEmailRegistration(database, {
      actor,
      password: body.password,
      tokenHash
    })
  })

  if (result.isNewUser) {
    await updateAppSession(event, { userId: result.userId })
  }

  return {
    user: {
      userId: result.userId,
      isAdmin: result.isAdmin,
      isGuest: false,
      email: result.email
    },

    redirectTo: result.redirectTo
  }
})
