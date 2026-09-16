import { createError, isError, type H3Event } from 'h3'
import { useAppSession } from '#server/utils/session'
import { getSessionUser } from '#server/utils/user'
import { hashToken } from '#server/utils/auth/password'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import type { TwitchOAuthActor } from './twitch-state-persistence'

async function getTwitchOAuthContext(event: H3Event) {
  const user = await getSessionUser(event)
  const session = await useAppSession(event)

  if (session.id === undefined || session.id === '') {
    throw createError({
      status: 400,
      statusMessage: twitchOAuthMessages.invalid
    })
  }

  const sessionIdHash = hashToken(session.id)

  const actor: TwitchOAuthActor = {
    userId: user.userId,
    sessionIdHash
  }

  return {
    actor,
    sessionVersion: session.data.sessionVersion ?? 0,
    user
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

    if (error.statusCode === 401) {
      return createError({
        status: 401,
        statusMessage: twitchOAuthMessages.signInRequired
      })
    }

    if (error.statusCode === 409) {
      const allowedConflictMessages = new Set<string>([
        twitchOAuthMessages.alreadyLinked,
        twitchOAuthMessages.alreadySignedIn,
        twitchOAuthMessages.linkConflict
      ])

      const conflictMessage = error.statusMessage

      const statusMessage = conflictMessage !== undefined && allowedConflictMessages.has(conflictMessage)
        ? conflictMessage
        : twitchOAuthMessages.linkConflict

      return createError({
        status: 409,
        statusMessage
      })
    }

    if (error.statusCode === 429 && error.statusMessage === twitchOAuthMessages.tooManyAttempts) {
      return createError({
        status: 429,
        statusMessage: twitchOAuthMessages.tooManyAttempts
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

function getTwitchDisconnectError(error: unknown, sensitiveValues: readonly string[]) {
  if (isError(error)) {
    if (error.statusCode === 401) {
      return createError({
        status: 401,
        statusMessage: twitchOAuthMessages.disconnectSignInRequired
      })
    }

    if (
      error.statusCode === 409
      && error.statusMessage === twitchOAuthMessages.disconnectEmailRequired
    ) {
      return createError({
        status: 409,
        statusMessage: twitchOAuthMessages.disconnectEmailRequired
      })
    }
  }

  const details = getAuthErrorDetails(error, sensitiveValues)

  console.error('Twitch disconnect failed', { error: details })

  return createError({
    status: 503,
    statusMessage: twitchOAuthMessages.disconnectUnavailable
  })
}

export { getTwitchOAuthContext, getTwitchOAuthError, getTwitchDisconnectError }
