import { eq } from 'drizzle-orm'

import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readValidatedBody,
  setResponseHeader,
  type H3Event
} from 'h3'

import { emailSignInTurnstileAction } from '#shared/utils/turnstile'
import { emailCredentials, users } from '#server/database/schema'
import { getEmailAuthenticationOrigin } from '#server/utils/config'
import { getEmailSignInRateLimiterBinding, getGuestClientIp } from '#server/utils/cloudflare'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { hashToken, verifyPassword } from '#server/utils/auth/password'
import { getAppSession, updateAppSession } from '#server/utils/session'
import { verifyTurnstile } from '#server/utils/turnstile'
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
}

const dummyPasswordHash = 'scrypt$16384$8$5$000102030405060708090a0b0c0d0e0f$bc15d746c7f07d6f7ccb16091cdfe92b415017482bc5e0e7f8b2c56feb42a30bc89c78df63d561112afb46bc572a74e4e7e1c4284018ccaeb2e1a42b6929156b'

function validateSignInRequest(event: H3Event): void {
  const contentType = getRequestHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase()

  if (contentType !== 'application/json') {
    throw createError({
      status: 415,
      statusMessage: 'JSON is required'
    })
  }

  const expectedOrigin = getEmailAuthenticationOrigin(event)
  const origin = getRequestHeader(event, 'origin')
  const fetchSite = getRequestHeader(event, 'sec-fetch-site')

  if (origin !== expectedOrigin || fetchSite === 'cross-site') {
    throw createError({
      status: 403,
      statusMessage: 'Request origin is not allowed'
    })
  }
}

async function getEmailSignInRateLimitOutcomes(
  event: H3Event,
  keys: readonly string[]
): Promise<RateLimitOutcome[]> {
  try {
    const binding = getEmailSignInRateLimiterBinding(event)

    return await Promise.all(keys.map(async key => binding.limit({ key })))
  } catch (error) {
    const details = getAuthErrorDetails(error, keys)

    console.error('Email sign-in rate limit failed', { error: details })

    throw createError({
      cause: details,
      status: 503,
      statusMessage: 'Email sign-in is temporarily unavailable'
    })
  }
}

async function enforceEmailSignInRateLimit(
  event: H3Event,
  keys: readonly string[]
): Promise<void> {
  const outcomes = await getEmailSignInRateLimitOutcomes(event, keys)

  if (outcomes.some(outcome => !outcome.success)) {
    setResponseHeader(event, 'Retry-After', 60)

    throw createError({
      status: 429,
      statusMessage: 'Too many sign-in attempts. Try again in a minute'
    })
  }
}

async function findEmailCredential(
  event: H3Event,
  email: string
): Promise<EmailCredentialResult | undefined> {
  const [credential] = await event.context.dbHttp
    .select({
      email: emailCredentials.email,
      passwordHash: emailCredentials.passwordHash,
      userId: emailCredentials.userId,
      isAdmin: users.isAdmin
    })
    .from(emailCredentials)
    .innerJoin(users, eq(users.id, emailCredentials.userId))
    .where(
      eq(emailCredentials.email, email)
    )

  return credential
}

export default defineEventHandler(async (event): Promise<EmailSignInResponse> => {
  validateSignInRequest(event)

  const body = await readValidatedBody(event, validateEmailSignIn)
  const clientIp = getGuestClientIp(event, import.meta.dev === true)

  await verifyTurnstile(event, body['cf-turnstile-response'], {
    remoteIp: clientIp,
    expectedAction: emailSignInTurnstileAction
  })

  const emailHash = hashToken(body.email)
  const rateLimitKeys = [`ip:${clientIp}`, `email:${emailHash}`]

  await enforceEmailSignInRateLimit(event, rateLimitKeys)

  const session = await getAppSession(event)

  if (session.data.userId !== undefined) {
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

  await updateAppSession(event, { userId: credential.userId })

  return {
    email: credential.email,
    userId: credential.userId,
    isAdmin: credential.isAdmin,
    isGuest: false
  }
})

export type { EmailSignInResponse }
