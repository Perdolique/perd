import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { getFetchErrorResponse } from './fetch-error'

const messages = Object.values(twitchOAuthMessages)
const allowedMessages = new Set<string>(messages)

const allowedDisconnectMessages = new Set<string>([
  twitchOAuthMessages.disconnectEmailRequired,
  twitchOAuthMessages.disconnectSignInRequired,
  twitchOAuthMessages.disconnectUnavailable
])

function getTwitchCallbackError(error: unknown): string {
  const { statusMessage } = getFetchErrorResponse(error)

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

export { getTwitchCallbackError, getTwitchDisconnectError }
