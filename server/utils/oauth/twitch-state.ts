import { createError, isError, type H3Event } from 'h3'
import { useAppSession } from '#server/utils/session'
import { getSessionUser } from '#server/utils/user'
import { hashToken } from '#server/utils/auth/password'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import type { TwitchOAuthActor } from './twitch-state-persistence'

async function getTwitchOAuthActor(event: H3Event): Promise<TwitchOAuthActor> {
  const user = await getSessionUser(event)
  const session = await useAppSession(event)

  if (session.id === undefined || session.id === '') {
    throw createError({
      status: 400,
      statusMessage: twitchOAuthMessages.invalid
    })
  }

  const sessionIdHash = hashToken(session.id)

  return {
    sessionIdHash,
    userId: user.userId
  }
}

function getTwitchOAuthError(error: unknown, sensitiveValues: readonly string[]) {
  if (isError(error)) {
    if (error.statusCode === 400) {
      const statusMessage = error.statusMessage === twitchOAuthMessages.cancelled
        ? twitchOAuthMessages.cancelled
        : twitchOAuthMessages.invalid

      return createError({
        status: 400,
        statusMessage
      })
    }

    if (error.statusCode === 401 || error.statusCode === 409) {
      const statusMessage = error.statusCode === 401
        ? twitchOAuthMessages.signInRequired
        : twitchOAuthMessages.alreadySignedIn

      return createError({
        status: error.statusCode,
        statusMessage
      })
    }

    if (error.statusCode === 429 && error.statusMessage === twitchOAuthMessages.tooManyAttempts) {
      return createError({
        status: 429,
        statusMessage: twitchOAuthMessages.tooManyAttempts
      })
    }

    if (error.statusCode === 501 && error.statusMessage === twitchOAuthMessages.linkingUnavailable) {
      return createError({
        status: 501,
        statusMessage: twitchOAuthMessages.linkingUnavailable
      })
    }
  }

  const details = getAuthErrorDetails(error, sensitiveValues)

  console.error('Twitch OAuth failed', { error: details })

  return createError({
    status: 503,
    statusMessage: twitchOAuthMessages.unavailable
  })
}

export { getTwitchOAuthActor, getTwitchOAuthError }
