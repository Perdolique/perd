import { defineEventHandler } from 'h3'
import { passwordRecoveryResetTurnstileAction } from '#shared/utils/turnstile'
import { getEmailAuthenticationConfig } from '#server/utils/config'
import { getGuestClientIp, getPasswordRecoveryRateLimiterBinding } from '#server/utils/cloudflare'

import {
  enforceEmailAuthenticationRateLimit,
  readLimitedValidatedJsonBody,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { hashPassword, hashToken } from '#server/utils/auth/password'
import { withPasswordRecoveryDatabase } from '#server/utils/auth/password-recovery'
import { assertPasswordNotPwned } from '#server/utils/auth/pwned-passwords'

import {
  completePasswordRecovery,
  findPasswordRecoveryEmail,
  invalidPasswordRecovery
} from '#server/utils/auth/password-recovery-persistence'

import { verifyTurnstile } from '#server/utils/turnstile'
import { validatePasswordRecoveryReset } from '#server/utils/validation/schemas'

interface PasswordRecoveryResetResponse {
  reset: true;
}

const maximumPasswordRecoveryResetBodyByteLength = 4096

export default defineEventHandler(async (event): Promise<PasswordRecoveryResetResponse> => {
  const config = getEmailAuthenticationConfig(event)

  validateEmailAuthenticationRequest(event, config.origin)

  const body = await readLimitedValidatedJsonBody(
    event,
    maximumPasswordRecoveryResetBodyByteLength,
    validatePasswordRecoveryReset
  )

  const clientIp = getGuestClientIp(event, import.meta.dev === true)

  await verifyTurnstile(event, body['cf-turnstile-response'], {
    remoteIp: clientIp,
    expectedAction: passwordRecoveryResetTurnstileAction
  })

  const limiterOptions = {
    deniedStatusMessage: 'Too many recovery attempts. Try again in a minute',
    getBinding: () => getPasswordRecoveryRateLimiterBinding(event),
    logMessage: 'Password recovery rate limit failed',
    unavailableStatusMessage: 'Password recovery is temporarily unavailable'
  } as const

  await enforceEmailAuthenticationRateLimit(event, {
    ...limiterOptions,
    keys: [`reset-ip:${clientIp}`]
  })

  if (!/^[\w-]{43}$/u.test(body.token)) {
    throw invalidPasswordRecovery()
  }

  const tokenHash = hashToken(body.token)
  const sensitiveValues = [body.password, body.token, tokenHash]

  await withPasswordRecoveryDatabase(event, sensitiveValues, async (database) => {
    const email = await findPasswordRecoveryEmail(database, tokenHash)
    const emailHash = hashToken(email)

    await enforceEmailAuthenticationRateLimit(event, {
      ...limiterOptions,
      keys: [`reset-email:${emailHash}`]
    })

    await assertPasswordNotPwned(body.password)

    const passwordHash = await hashPassword(body.password)

    await completePasswordRecovery(database, {
      email,
      passwordHash,
      tokenHash
    })
  })

  return { reset: true }
})
