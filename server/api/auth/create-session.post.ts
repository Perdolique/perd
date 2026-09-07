import { createError, defineEventHandler, readBody, setResponseHeader, setResponseStatus, type H3Event } from 'h3'
import { turnstileResponseFieldName } from '#shared/utils/turnstile'
import { users } from '#server/database/schema'
import { getGuestClientIp, getGuestSessionRateLimiterBinding } from '#server/utils/cloudflare'
import { useAppSession } from '#server/utils/session'
import { verifyGuestSessionTurnstile } from '#server/utils/turnstile'
import { getSessionUser } from '#server/utils/user'

interface GuestSessionResponse {
  readonly isGuest: boolean;
  readonly userId: string;
}

interface GuestUserResult {
  readonly isCreated: boolean;
  readonly userId: string;
}

function getTurnstileToken(body: unknown): unknown {
  if (body === null || typeof body !== 'object') {
    return
  }

  return Reflect.get(body, turnstileResponseFieldName)
}

async function getGuestSessionRateLimitOutcome(
  event: H3Event,
  clientIp: string
): Promise<RateLimitOutcome> {
  try {
    const binding = getGuestSessionRateLimiterBinding(event)

    return await binding.limit({ key: clientIp })
  } catch (error) {
    console.error('Failed to apply Guest session rate limit', { error })

    throw createError({
      cause: error,
      status: 503,
      statusMessage: 'Guest access is temporarily unavailable'
    })
  }
}

async function enforceGuestSessionRateLimit(event: H3Event, clientIp: string): Promise<void> {
  const outcome = await getGuestSessionRateLimitOutcome(event, clientIp)

  if (outcome.success === false) {
    setResponseHeader(event, 'Retry-After', 60)

    throw createError({
      status: 429,
      statusMessage: 'Too many Guest attempts'
    })
  }
}

async function createOrReuseGuestUser(
  event: H3Event,
  guestSessionId: string
): Promise<GuestUserResult> {
  const { dbHttp } = event.context

  const [newUser] = await dbHttp
    .insert(users)
    .values({ guestSessionId })
    .onConflictDoNothing({ target: users.guestSessionId })
    .returning({
      userId: users.id
    })

  if (newUser !== undefined) {
    return {
      isCreated: true,
      userId: newUser.userId
    }
  }

  const existingUser = await dbHttp.query.users.findFirst({
    columns: {
      id: true
    },

    where: {
      guestSessionId
    }
  })

  if (existingUser === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create or reuse Guest user'
    })
  }

  return {
    isCreated: false,
    userId: existingUser.id
  }
}

export default defineEventHandler(async (event) : Promise<GuestSessionResponse> => {
  const body: unknown = await readBody(event)
  const turnstileToken = getTurnstileToken(body)
  const clientIp = getGuestClientIp(event, import.meta.dev)

  await verifyGuestSessionTurnstile(event, turnstileToken, clientIp)
  await enforceGuestSessionRateLimit(event, clientIp)

  const currentUser = await getSessionUser(event)

  if (currentUser.userId !== null) {
    setResponseStatus(event, 200)

    return {
      isGuest: currentUser.isGuest,
      userId: currentUser.userId
    }
  }

  const session = await useAppSession(event)

  if (session.id === undefined || session.id === '') {
    throw createError({
      status: 503,
      statusMessage: 'Guest access is temporarily unavailable'
    })
  }

  const guestUser = await createOrReuseGuestUser(event, session.id)

  await session.update({
    userId: guestUser.userId
  })

  setResponseStatus(event, guestUser.isCreated ? 201 : 200)

  return {
    isGuest: true,
    userId: guestUser.userId
  }
})

export type { GuestSessionResponse }
