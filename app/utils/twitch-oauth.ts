import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { getFetchErrorResponse } from './fetch-error'

const messages = Object.values(twitchOAuthMessages)
const allowedMessages = new Set<string>(messages)

function getTwitchCallbackError(error: unknown): string {
  const { statusMessage } = getFetchErrorResponse(error)

  if (statusMessage !== undefined && allowedMessages.has(statusMessage)) {
    return statusMessage
  }

  return twitchOAuthMessages.unavailable
}

export { getTwitchCallbackError }
