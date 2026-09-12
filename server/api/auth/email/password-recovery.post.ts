import { defineEventHandler, setResponseStatus } from 'h3'
import { passwordRecoveryRequestTurnstileAction } from '#shared/utils/turnstile'
import { getEmailAuthenticationConfig, getRuntimeDatabaseConfig } from '#server/utils/config'
import { getEmailBinding, getGuestClientIp, getPasswordRecoveryRateLimiterBinding } from '#server/utils/cloudflare'

import {
  enforceEmailAuthenticationRateLimit,
  readLimitedValidatedJsonBody,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { createVerificationToken, hashToken } from '#server/utils/auth/password'
import { runPasswordRecoveryIssuance } from '#server/utils/auth/password-recovery'
import { verifyTurnstile } from '#server/utils/turnstile'
import { validatePasswordRecoveryRequest } from '#server/utils/validation/schemas'

interface PasswordRecoveryResponse {
  accepted: true;
}

const maximumPasswordRecoveryBodyByteLength = 4096

export default defineEventHandler(async (event): Promise<PasswordRecoveryResponse> => {
  const config = getEmailAuthenticationConfig(event)

  validateEmailAuthenticationRequest(event, config.origin)

  const body = await readLimitedValidatedJsonBody(
    event,
    maximumPasswordRecoveryBodyByteLength,
    validatePasswordRecoveryRequest
  )

  const clientIp = getGuestClientIp(event, import.meta.dev === true)

  await verifyTurnstile(event, body['cf-turnstile-response'], {
    remoteIp: clientIp,
    expectedAction: passwordRecoveryRequestTurnstileAction
  })

  const emailHash = hashToken(body.email)

  await enforceEmailAuthenticationRateLimit(event, {
    deniedStatusMessage: 'Too many recovery attempts. Try again in a minute',
    getBinding: () => getPasswordRecoveryRateLimiterBinding(event),
    keys: [`request-ip:${clientIp}`, `request-email:${emailHash}`],
    logMessage: 'Password recovery rate limit failed',
    unavailableStatusMessage: 'Password recovery is temporarily unavailable'
  })

  const binding = getEmailBinding(event)
  const databaseConfig = getRuntimeDatabaseConfig(event)
  const token = createVerificationToken()
  const tokenHash = hashToken(token)

  event.waitUntil(runPasswordRecoveryIssuance({
    binding,
    config,
    databaseConfig,
    email: body.email,
    redirectTo: body.redirectTo,
    token,
    tokenHash
  }))

  setResponseStatus(event, 202)

  return { accepted: true }
})
