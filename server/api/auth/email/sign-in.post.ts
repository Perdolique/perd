import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, type H3Event } from 'h3'
import { emailSignInTurnstileAction } from '#shared/utils/turnstile'
import { emailCredentials, users } from '#server/database/schema'
import { getEmailAuthenticationOrigin } from '#server/utils/config'
import { getEmailSignInRateLimiterBinding, getGuestClientIp } from '#server/utils/cloudflare'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'

import {
  enforceEmailAuthenticationRateLimit,
  readLimitedValidatedJsonBody,
  validateEmailAuthenticationRequest
} from '#server/utils/auth/email-authentication-request'

import { hashToken, verifyPassword } from '#server/utils/auth/password'
import { updateAppSession } from '#server/utils/session'
import { verifyTurnstile } from '#server/utils/turnstile'
import { getSessionUser } from '#server/utils/user'
import { validateEmailSignIn } from '#server/utils/validation/schemas'

interface EmailSignInResponse {
  readonly email: string;
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly isGuest: false;
}

interface EmailCredentialResult {
  readonly email: string;
  readonly passwordHash: string;
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly sessionVersion: number;
}

const dummyPasswordHash = 'scrypt$16384$8$5$000102030405060708090a0b0c0d0e0f$bc15d746c7f07d6f7ccb16091cdfe92b415017482bc5e0e7f8b2c56feb42a30bc89c78df63d561112afb46bc572a74e4e7e1c4284018ccaeb2e1a42b6929156b'
const maximumSignInBodyByteLength = 4096

async function findEmailCredential(
  event: H3Event,
  email: string
): Promise<EmailCredentialResult | undefined> {
  try {
    const [credential] = await event.context.dbHttp
      .select({
        email: emailCredentials.email,
        passwordHash: emailCredentials.passwordHash,
        userId: emailCredentials.userId,
        isAdmin: users.isAdmin,
        sessionVersion: users.sessionVersion
      })
      .from(emailCredentials)
      .innerJoin(users, eq(users.id, emailCredentials.userId))
      .where(
        eq(emailCredentials.email, email)
      )

    return credential
  } catch (error) {
    const details = getAuthErrorDetails(error, [email])

    console.error('Email sign-in credential lookup failed', { error: details })

    throw createError({
      cause: details,
      status: 503,
      statusMessage: 'Email sign-in is temporarily unavailable'
    })
  }
}

export default defineEventHandler(async (event): Promise<EmailSignInResponse> => {
  const expectedOrigin = getEmailAuthenticationOrigin(event)

  validateEmailAuthenticationRequest(event, expectedOrigin)

  const body = await readLimitedValidatedJsonBody(
    event,
    maximumSignInBodyByteLength,
    validateEmailSignIn
  )

  const clientIp = getGuestClientIp(event, import.meta.dev === true)

  await enforceEmailAuthenticationRateLimit(event, {
    deniedStatusMessage: 'Too many sign-in attempts. Try again in a minute',
    getBinding: () => getEmailSignInRateLimiterBinding(event),
    keys: [`ip:${clientIp}`],
    logMessage: 'Email sign-in rate limit failed',
    unavailableStatusMessage: 'Email sign-in is temporarily unavailable'
  })

  await verifyTurnstile(event, body['cf-turnstile-response'], {
    remoteIp: clientIp,
    expectedAction: emailSignInTurnstileAction
  })

  const emailHash = hashToken(body.email)

  await enforceEmailAuthenticationRateLimit(event, {
    deniedStatusMessage: 'Too many sign-in attempts. Try again in a minute',
    getBinding: () => getEmailSignInRateLimiterBinding(event),
    keys: [`email:${emailHash}`],
    logMessage: 'Email sign-in rate limit failed',
    unavailableStatusMessage: 'Email sign-in is temporarily unavailable'
  })

  const sessionUser = await getSessionUser(event)

  if (sessionUser.userId !== null) {
    throw createError({
      status: 409,
      statusMessage: 'A user is already signed in'
    })
  }

  const credential = await findEmailCredential(event, body.email)
  const passwordHash = credential?.passwordHash ?? dummyPasswordHash
  const passwordMatches = await verifyPassword(body.password, passwordHash)

  if (credential === undefined || !passwordMatches) {
    throw createError({
      status: 401,
      statusMessage: 'Email or password is incorrect'
    })
  }

  await updateAppSession(event, {
    userId: credential.userId,
    sessionVersion: credential.sessionVersion
  })

  return {
    email: credential.email,
    userId: credential.userId,
    isAdmin: credential.isAdmin,
    isGuest: false
  }
})

export type { EmailSignInResponse }
