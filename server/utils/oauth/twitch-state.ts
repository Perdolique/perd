import { createError, isNuxtError, type RequestEvent } from 'nuxt/server'
import { useAppSession } from '#server/utils/session'
import { getSessionUser } from '#server/utils/user'
import { hashToken } from '#server/utils/auth/password'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import type { TwitchOAuthActor } from './twitch-state-persistence'

async function getTwitchOAuthContext(event: RequestEvent) {
  const user = await getSessionUser(event)
  const session = await useAppSession(event)

  if (session.id === '') {
    throw createError({
      status: 400,
      statusText: twitchOAuthMessages.invalid
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
  if (isNuxtError(error)) {
    if (error.status === 400) {
      const statusText = error.statusText === twitchOAuthMessages.cancelled
        ? twitchOAuthMessages.cancelled
        : twitchOAuthMessages.invalid

      return createError({
        status: 400,
        statusText
      })
    }

    if (error.status === 401) {
      return createError({
        status: 401,
        statusText: twitchOAuthMessages.signInRequired
      })
    }

    if (error.status === 409) {
      const allowedConflictMessages = new Set<string>([
        twitchOAuthMessages.alreadyLinked,
        twitchOAuthMessages.alreadySignedIn,
        twitchOAuthMessages.linkConflict
      ])

      const conflictMessage = error.statusText

      const statusText = conflictMessage !== undefined && allowedConflictMessages.has(conflictMessage)
        ? conflictMessage
        : twitchOAuthMessages.linkConflict

      return createError({
        status: 409,
        statusText
      })
    }

    if (error.status === 429 && error.statusText === twitchOAuthMessages.tooManyAttempts) {
      return createError({
        status: 429,
        statusText: twitchOAuthMessages.tooManyAttempts
      })
    }

  }

  const details = getAuthErrorDetails(error, sensitiveValues)

  console.error('Twitch OAuth failed', { error: details })

  return createError({
    status: 503,
    statusText: twitchOAuthMessages.unavailable
  })
}

function getTwitchDisconnectError(error: unknown, sensitiveValues: readonly string[]) {
  if (isNuxtError(error)) {
    if (error.status === 401) {
      return createError({
        status: 401,
        statusText: twitchOAuthMessages.disconnectSignInRequired
      })
    }

    if (
      error.status === 409
      && error.statusText === twitchOAuthMessages.disconnectEmailRequired
    ) {
      return createError({
        status: 409,
        statusText: twitchOAuthMessages.disconnectEmailRequired
      })
    }
  }

  const details = getAuthErrorDetails(error, sensitiveValues)

  console.error('Twitch disconnect failed', { error: details })

  return createError({
    status: 503,
    statusText: twitchOAuthMessages.disconnectUnavailable
  })
}

export { getTwitchOAuthContext, getTwitchOAuthError, getTwitchDisconnectError }
