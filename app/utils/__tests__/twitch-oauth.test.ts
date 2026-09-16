import { describe, expect, it } from 'vitest'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { getTwitchDisconnectError } from '../twitch-oauth'

describe(getTwitchDisconnectError, () => {
  it.each([
    twitchOAuthMessages.disconnectEmailRequired,
    twitchOAuthMessages.disconnectSignInRequired,
    twitchOAuthMessages.disconnectUnavailable
  ])('keeps the safe disconnect message %s', (statusMessage) => {
    const error = {
      data: {
        statusCode: 409,
        statusMessage
      }
    }

    expect(getTwitchDisconnectError(error)).toBe(statusMessage)
  })

  it('hides an unknown server error', () => {
    const error = {
      data: {
        statusCode: 500,
        statusMessage: 'private database failure'
      }
    }

    expect(getTwitchDisconnectError(error)).toBe(twitchOAuthMessages.disconnectUnavailable)
  })
})
