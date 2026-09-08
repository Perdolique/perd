import { createError, getRequestHeader, setResponseHeader, type H3Event } from 'h3'
import type { EmailRegistrationConfig } from './email-registration-config'
import { getAuthErrorDetails } from './telemetry'

type RegistrationLimiter = 'EMAIL_REGISTRATION_RATE_LIMITER' | 'EMAIL_VERIFICATION_RATE_LIMITER'

function validateRegistrationRequest(event: H3Event, config: EmailRegistrationConfig): void {
  const contentType = getRequestHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase()

  if (contentType !== 'application/json') {
    throw createError({
      status: 415,
      statusMessage: 'JSON is required'
    })
  }

  const origin = getRequestHeader(event, 'origin')
  const fetchSite = getRequestHeader(event, 'sec-fetch-site')

  if (origin !== config.origin || fetchSite === 'cross-site') {
    throw createError({
      status: 403,
      statusMessage: 'Request origin is not allowed'
    })
  }
}

async function getRegistrationRateLimitOutcomes(
  event: H3Event,
  name: RegistrationLimiter,
  keys: readonly string[]
): Promise<RateLimitOutcome[]> {
  try {
    const binding = event.context.cloudflare?.env[name]

    if (binding === undefined) {
      throw new Error(`Missing binding ${name}`)
    }

    return await Promise.all(keys.map(async key => binding.limit({ key })))
  } catch (error) {
    const details = getAuthErrorDetails(error, keys)

    console.error('Email registration rate limit failed', { error: details })

    throw createError({
      status: 503,
      statusMessage: 'Email registration is temporarily unavailable'
    })
  }
}

async function enforceRegistrationRateLimit(event: H3Event, name: RegistrationLimiter, keys: readonly string[]): Promise<void> {
  const outcomes = await getRegistrationRateLimitOutcomes(event, name, keys)

  if (outcomes.some(outcome => !outcome.success)) {
    setResponseHeader(event, 'Retry-After', 60)

    throw createError({
      status: 429,
      statusMessage: 'Too many attempts. Try again in a minute'
    })
  }
}

export { enforceRegistrationRateLimit, validateRegistrationRequest }
