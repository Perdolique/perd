import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import type { LocationQuery } from 'vue-router'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { getTwitchCallbackBody, getTwitchCallbackError, getTwitchDisconnectError } from '../twitch-oauth'

describe(getTwitchCallbackBody, () => {
  it('keeps a successful callback without unrelated URL parameters', () => {
    const body = getTwitchCallbackBody({
      code: 'oauth-code',
      state: 'opaque-state',
      redirectTo: '/admin'
    })

    expect(body).toStrictEqual({
      code: 'oauth-code',
      state: 'opaque-state'
    })
  })

  it('keeps a cancellation for server verification', () => {
    const body = getTwitchCallbackBody({
      error: 'access_denied',
      state: 'opaque-state'
    })

    expect(body).toStrictEqual({
      error: 'access_denied',
      state: 'opaque-state'
    })
  })

  const malformedCallbacks: LocationQuery[] = [
    { code: 'oauth-code' },
    {
      code: 'oauth-code',
      state: ['one', 'two']
    },
    {
      code: null,
      state: 'opaque-state'
    },
    {
      code: ['one', 'two'],
      state: 'opaque-state'
    },
    {
      error: 'access_denied',
      code: ['one', 'two'],
      state: 'opaque-state'
    },
    {
      code: 'oauth-code',
      error: null,
      state: 'opaque-state'
    },
    {
      code: 'oauth-code',
      error: 'access_denied',
      state: 'opaque-state'
    },
    { state: 'opaque-state' }
  ]

  it.each(malformedCallbacks)('rejects malformed callback %j', (query) => {
    expect(() => getTwitchCallbackBody(query)).toThrow(twitchOAuthMessages.invalid)
  })

  it('keeps the safe message for local callback errors', () => {
    const error = createError({
      status: 400,
      statusMessage: twitchOAuthMessages.invalid
    })

    const message = getTwitchCallbackError(error)

    expect(message).toBe(twitchOAuthMessages.invalid)
  })
})

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
