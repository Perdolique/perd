import { createError, isError } from 'h3'
import type { InferInput } from 'valibot'
import type { LocationQuery } from 'vue-router'
import type { twitchOAuthBodySchema } from '#server/utils/validation/schemas'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { getFetchErrorResponse } from './fetch-error'

const messages = Object.values(twitchOAuthMessages)
const allowedMessages = new Set<string>(messages)

const allowedDisconnectMessages = new Set<string>([
  twitchOAuthMessages.disconnectEmailRequired,
  twitchOAuthMessages.disconnectSignInRequired,
  twitchOAuthMessages.disconnectUnavailable
])

/** Reads either a successful callback or a cancellation from URL query values. */
function getTwitchCallbackBody(query: LocationQuery): InferInput<typeof twitchOAuthBodySchema> {
  const { code, error, state } = query

  if (typeof state === 'string') {
    if (typeof code === 'string' && error === undefined) {
      return {
        code,
        state
      }
    }

    if (typeof error === 'string' && code === undefined) {
      return {
        error,
        state
      }
    }
  }

  throw createError({
    status: 400,
    statusMessage: twitchOAuthMessages.invalid
  })
}

function getTwitchCallbackError(error: unknown): string {
  const statusMessage = isError(error) ? error.statusMessage : getFetchErrorResponse(error).statusMessage

  if (statusMessage !== undefined && allowedMessages.has(statusMessage)) {
    return statusMessage
  }

  return twitchOAuthMessages.unavailable
}

function getTwitchDisconnectError(error: unknown): string {
  const { statusMessage } = getFetchErrorResponse(error)

  if (statusMessage !== undefined && allowedDisconnectMessages.has(statusMessage)) {
    return statusMessage
  }

  return twitchOAuthMessages.disconnectUnavailable
}

export { getTwitchCallbackBody, getTwitchCallbackError, getTwitchDisconnectError }
