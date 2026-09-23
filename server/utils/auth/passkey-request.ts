import { createError, getRequestHeader, isError, setResponseHeader, type H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { passkeyMessages } from '#shared/utils/passkey'
import { getTrustedClientIp } from '#server/utils/cloudflare'
import { getSessionUser } from '#server/utils/user'
import { useAppSession } from '#server/utils/session'
import { hashToken } from './password'
import { getAuthErrorDetails } from './telemetry'
import { enforceEmailAuthenticationRateLimit } from './email-authentication-request'

type PasskeyOperation = 'authentication' | 'registration' | 'management'

interface PasskeyConfig {
  origin: string;
  rpId: string;
}

interface PasskeyActor {
  sessionIdHash: string;
  userId: string | null;
  sessionVersion: number | null;
}

class PasskeyVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)

    this.name = 'PasskeyVerificationError'
  }
}

function validatePasskeyOrigin(origin: unknown): PasskeyConfig {
  if (typeof origin === 'string') {
    try {
      const url = new URL(origin)
      const isSecure = url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')

      if (isSecure && url.origin === origin) {
        return {
          origin,
          rpId: url.hostname
        }
      }
    } catch {
      // Invalid configuration is handled with the same safe response below.
    }
  }

  throw createError({
    status: 503,
    statusMessage: passkeyMessages.unavailable
  })
}

function getPasskeyConfig(event: H3Event): PasskeyConfig {
  const config = useRuntimeConfig(event)

  return validatePasskeyOrigin(config.passkeys.origin)
}

function validatePasskeyRequest(event: H3Event, config: PasskeyConfig): void {
  const origin = getRequestHeader(event, 'origin')
  const fetchSite = getRequestHeader(event, 'sec-fetch-site')

  if (origin !== config.origin || fetchSite === 'cross-site') {
    throw createError({
      status: 403,
      statusMessage: 'Request origin is not allowed'
    })
  }

  if (event.method !== 'DELETE') {
    const contentType = getRequestHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase()

    if (contentType !== 'application/json') {
      throw createError({
        status: 415,
        statusMessage: 'JSON is required'
      })
    }
  }
}

async function enforcePasskeyRateLimit(event: H3Event, key: string): Promise<void> {
  await enforceEmailAuthenticationRateLimit(event, {
    getBinding() {
      const binding = event.context.cloudflare?.env.PASSKEY_RATE_LIMITER

      if (binding === undefined) {
        throw new Error('Passkey rate limiter binding is unavailable')
      }

      return binding
    },

    keys: [key],
    deniedStatusMessage: passkeyMessages.tooManyAttempts,
    unavailableStatusMessage: passkeyMessages.unavailable,
    logMessage: 'Passkey rate limit failed'
  })
}

async function getPasskeyActor(event: H3Event, operation: PasskeyOperation) {
  const user = await getSessionUser(event)

  if (operation === 'authentication' && user.userId !== null) {
    throw createError({
      status: 409,
      statusMessage: passkeyMessages.alreadySignedIn
    })
  }

  if (operation !== 'authentication' && user.userId === null) {
    throw createError({ status: 401 })
  }

  if (operation === 'registration' && user.email === null && !user.isTwitchLinked) {
    throw createError({
      status: 403,
      statusMessage: passkeyMessages.durableAccountRequired
    })
  }

  const session = await useAppSession(event)

  if (session.id === undefined || session.id === '') {
    throw new PasskeyVerificationError('Application session is missing')
  }

  const actor: PasskeyActor = {
    sessionIdHash: hashToken(session.id),
    userId: user.userId,
    sessionVersion: user.userId === null ? null : session.data.sessionVersion ?? 0
  }

  return {
    actor,
    user
  }
}

async function limitPasskeyAuthentication(event: H3Event, phase: 'options' | 'verify'): Promise<void> {
  const ip = getTrustedClientIp(event, import.meta.dev === true)

  await enforcePasskeyRateLimit(event, `authentication:${phase}:ip:${ip}`)
}

/** Owns safe HTTP errors; callers add credential material before invoking verifiers or persistence. */
async function handlePasskeyRequest<Result>(
  event: H3Event,
  operation: PasskeyOperation,
  action: (sensitiveValues: string[]) => Promise<Result>
): Promise<Result> {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const sensitiveValues: string[] = []

  try {
    return await action(sensitiveValues)
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Passkey operation failed', {
      operation,
      error: details
    })

    if (error instanceof PasskeyVerificationError || (isError(error) && error.statusCode === 400)) {
      throw createError({
        status: operation === 'authentication' ? 401 : 400,
        statusMessage: passkeyMessages.invalid
      })
    }

    if (isError(error)) {
      const status = error.statusCode

      if ([401, 403, 404, 409, 413, 415, 429].includes(status)) {
        throw createError({
          status,
          statusMessage: error.statusMessage
        })
      }
    }

    throw createError({
      status: 503,
      statusMessage: passkeyMessages.unavailable
    })
  }
}

export {
  enforcePasskeyRateLimit,
  getPasskeyActor,
  getPasskeyConfig,
  handlePasskeyRequest,
  limitPasskeyAuthentication,
  PasskeyVerificationError,
  validatePasskeyOrigin,
  validatePasskeyRequest
}
export type { PasskeyActor, PasskeyConfig }
