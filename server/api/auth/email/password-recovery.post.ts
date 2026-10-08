import { scheduleBackgroundTask } from '#server/utils/request-runtime'
import type { InferInput } from 'valibot'
import { defineEventHandler, setResponseStatus } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { passwordRecoveryRequestTurnstileAction } from '#shared/utils/turnstile'
import { getEmailAuthenticationConfig, getRuntimeDatabaseConfig } from '#server/utils/config'
import { getEmailBinding, getPasswordRecoveryRateLimiterBinding, getTrustedClientIp } from '#server/utils/cloudflare'

import {
  enforceEmailAuthenticationRateLimit,
  readLimitedValidatedJsonBody,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { createVerificationToken, hashToken } from '#server/utils/auth/password'
import { runPasswordRecoveryIssuance } from '#server/utils/auth/password-recovery'
import { verifyTurnstile } from '#server/utils/turnstile'
import { validatePasswordRecoveryRequest, type passwordRecoveryRequestSchema } from '#server/utils/validation/schemas'

interface PasswordRecoveryResponse {
  accepted: true;
}

const maximumPasswordRecoveryBodyByteLength = 4096

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof passwordRecoveryRequestSchema>; }>): Promise<PasswordRecoveryResponse> => {
  const config = getEmailAuthenticationConfig()

  validateEmailAuthenticationRequest(event, config.origin)

  const body = await readLimitedValidatedJsonBody(
    event,
    maximumPasswordRecoveryBodyByteLength,
    validatePasswordRecoveryRequest
  )

  const clientIp = getTrustedClientIp(event, import.meta.dev === true)

  await verifyTurnstile(body['cf-turnstile-response'], {
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
  const databaseConfig = getRuntimeDatabaseConfig()
  const token = createVerificationToken()
  const tokenHash = hashToken(token)

  scheduleBackgroundTask(event, runPasswordRecoveryIssuance({
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
