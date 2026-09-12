import { createError, getResponseHeader, type sendRedirect } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import startTwitch from '#server/api/oauth/twitch/index.get'
import completeTwitch from '#server/api/oauth/twitch/index.post'
import { hashToken } from '#server/utils/auth/password'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { createTestEvent } from '~~/test-utils/create-test-event'

const mocks = vi.hoisted(() => {
  return {
    session: vi.fn(),
    user: vi.fn(),
    updateSession: vi.fn(),
    issue: vi.fn(),
    consume: vi.fn(),
    redirect: vi.fn<typeof sendRedirect>(),
    config: vi.fn(),
    token: vi.fn(),
    profile: vi.fn(),
    findUser: vi.fn(),
    createUser: vi.fn(),
    rateLimit: vi.fn()
  }
})

vi.mock(import('h3'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    sendRedirect: mocks.redirect
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    useAppSession: mocks.session,
    updateAppSession: mocks.updateSession
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    getSessionUser: mocks.user,
    getUserByOAuthAccount: mocks.findUser
  }
})

vi.mock(import('#server/utils/oauth/account'), () => {
  return {
    createOAuthUser: mocks.createUser
  }
})

vi.mock(import('#server/utils/oauth/twitch-state-persistence'), () => {
  return {
    issueTwitchOAuthState: mocks.issue,
    consumeTwitchOAuthState: mocks.consume
  }
})

vi.mock(import('#server/utils/oauth/twitch'), () => {
  return {
    getRuntimeTwitchConfig: mocks.config,
    getTwitchRedirectUri: () => 'https://metsik.app/auth/twitch',
    getTwitchOAuthToken: mocks.token,
    getTwitchUserInfo: mocks.profile
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return {
    getGuestClientIp: () => '203.0.113.20',

    getTwitchOAuthRateLimiterBinding: () => {
      return { limit: mocks.rateLimit }
    }
  }
})

const state = 'a'.repeat(43)
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477cc'

const account = {
  userId,
  email: 'verified@example.com',
  isAdmin: true,
  isGuest: false
}

const callbackBody = {
  code: 'oauth-code',
  state
}

function createCallbackEvent(body: unknown) {
  const event = createTestEvent({})

  event.node.req.method = 'POST'
  event.node.req.headers['content-type'] = 'application/json'

  Object.assign(event.node.req, { body })

  return event
}

function assertNoProviderWork() {
  expect(mocks.token).not.toHaveBeenCalled()
  expect(mocks.profile).not.toHaveBeenCalled()
  expect(mocks.findUser).not.toHaveBeenCalled()
  expect(mocks.createUser).not.toHaveBeenCalled()
  expect(mocks.updateSession).not.toHaveBeenCalled()
}

function assertNoActorWork() {
  expect(mocks.session).not.toHaveBeenCalled()
  expect(mocks.user).not.toHaveBeenCalled()
}

describe('twitch oauth', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Keep expected errors out of the test output.
    })

    mocks.session.mockResolvedValue({
      id: 'browser-session',
      data: {}
    })

    mocks.user.mockResolvedValue({ userId: null })

    mocks.config.mockReturnValue({
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    mocks.consume.mockResolvedValue({
      intent: 'sign-in',
      userId: null,
      redirectTo: '/my-gear'
    })

    mocks.token.mockResolvedValue('access-token')
    mocks.profile.mockResolvedValue({ id: 'twitch-id' })
    mocks.findUser.mockResolvedValue(account)

    mocks.createUser.mockResolvedValue({
      userId,
      isAdmin: false,
      isGuest: false
    })

    mocks.rateLimit.mockResolvedValue({ success: true })
  })

  afterEach(() => vi.restoreAllMocks())

  describe('twitch OAuth issuance', () => {
    it('issues distinct random states bound to an anonymous browser and stores only hashes', async () => {
      const event = createTestEvent({})

      event.node.req.url = '/api/oauth/twitch?redirectTo=%2Fmy-gear'

      await startTwitch(event)

      const authorizationUrl = new URL(String(mocks.redirect.mock.calls[0]?.[1]))
      const nonce = String(authorizationUrl.searchParams.get('state'))

      expect(nonce).toMatch(/^[\w-]{43}$/u)
      expect(authorizationUrl.origin).toBe('https://id.twitch.tv')
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('https://metsik.app/auth/twitch')

      expect(mocks.issue).toHaveBeenCalledWith(event.context.dbHttp, {
        actor: {
          userId: null,
          sessionIdHash: hashToken('browser-session')
        },

        stateHash: hashToken(nonce),
        intent: 'sign-in',
        redirectTo: '/my-gear'
      })

      expect(JSON.stringify(mocks.issue.mock.calls)).not.toContain(nonce)
      expect(mocks.rateLimit).toHaveBeenCalledWith({ key: '203.0.113.20' })
      expect(mocks.rateLimit.mock.invocationCallOrder[0]).toBeLessThan(Number(mocks.user.mock.invocationCallOrder[0]))
      expect(mocks.issue.mock.invocationCallOrder[0]).toBeLessThan(Number(mocks.redirect.mock.invocationCallOrder[0]))
      expect(getResponseHeader(event, 'Cache-Control')).toBe('no-store')
      await startTwitch(createTestEvent({}))

      const secondUrl = new URL(String(mocks.redirect.mock.calls[1]?.[1]))

      expect(secondUrl.searchParams.get('state')).not.toBe(nonce)
      assertNoProviderWork()
    })

    it('rejects rate-limited starts before session and database work', async () => {
      mocks.rateLimit.mockResolvedValue({ success: false })

      const event = createTestEvent({})

      await expect(startTwitch(event)).rejects.toMatchObject({
        statusCode: 429,
        statusMessage: twitchOAuthMessages.tooManyAttempts
      })

      expect(getResponseHeader(event, 'Retry-After')).toBe(60)
      assertNoActorWork()
      expect(mocks.issue).not.toHaveBeenCalled()
      expect(mocks.redirect).not.toHaveBeenCalled()
    })

    it('fails closed when the rate limiter is unavailable and redacts the client IP', async () => {
      mocks.rateLimit.mockRejectedValue(new Error('Rate limiter failed for 203.0.113.20'))

      await expect(startTwitch(createTestEvent({}))).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: twitchOAuthMessages.unavailable
      })

      assertNoActorWork()
      expect(mocks.issue).not.toHaveBeenCalled()

      const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

      expect(telemetry).toContain('Rate limiter failed')
      expect(telemetry).not.toContain('203.0.113.20')
    })

    it.each(['https://evil.example', '//evil.example', String.raw`/\evil.example`, '/\n/evil.example'])('sanitizes unsafe redirects before storage: %s', async (redirectTo) => {
      const event = createTestEvent({})
      const query = new URLSearchParams({ redirectTo })

      event.node.req.url = `/api/oauth/twitch?${query}`

      await startTwitch(event)
      expect(mocks.issue).toHaveBeenCalledWith(event.context.dbHttp, expect.objectContaining({ redirectTo: '/' }))
    })

    it('binds linking to the current user and session', async () => {
      mocks.user.mockResolvedValue(account)

      const event = createTestEvent({})

      event.node.req.url = '/api/oauth/twitch?intent=link&redirectTo=/account'

      await startTwitch(event)

      expect(mocks.issue).toHaveBeenCalledWith(event.context.dbHttp, expect.objectContaining({
        intent: 'link',

        actor: {
          userId,
          sessionIdHash: hashToken('browser-session')
        }
      }))
    })

    it.each([
      {
        intent: 'sign-in',
        currentUser: userId,
        status: 409
      },
      {
        intent: 'link',
        currentUser: null,
        status: 401
      },
      {
        intent: 'merge',
        currentUser: null,
        status: 400
      }
    ])('rejects $intent for $currentUser before issuance', async ({ intent, currentUser, status }) => {
      mocks.user.mockResolvedValue({ userId: currentUser })

      const event = createTestEvent({})

      event.node.req.url = `/api/oauth/twitch?intent=${intent}`

      await expect(startTwitch(event)).rejects.toMatchObject({ statusCode: status })
      expect(mocks.issue).not.toHaveBeenCalled()
      expect(mocks.redirect).not.toHaveBeenCalled()
      assertNoProviderWork()
    })

    it('does not redirect when persistence fails and preserves safe diagnostics', async () => {
      mocks.issue.mockRejectedValue(new Error('Database connection refused'))

      await expect(startTwitch(createTestEvent({}))).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: twitchOAuthMessages.unavailable
      })

      expect(mocks.redirect).not.toHaveBeenCalled()
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('Database connection refused')
    })
  })

  describe('twitch OAuth callback', () => {
    it.each([
      {}, { code: 'oauth-code' }, {
        code: 'oauth-code',
        state: '/my-gear'
      },
      {
        code: 'oauth-code',
        state: [state]
      }, {
        code: 'oauth-code',
        state: ` ${state}`
      },
      {
        code: 'oauth-code',
        state: null
      },
      {
        code: 'oauth-code',
        state: 'a'.repeat(42)
      },
      {
        code: 'oauth-code',
        state: 'a'.repeat(44)
      },
      { state }, {
        code: '',
        state
      },
      {
        error: '',
        state
      },
      {
        error: 'e'.repeat(129),
        state
      },
      {
        code: 'oauth-code',
        error: 'access_denied',
        state
      },
      {
        code: 'oauth-code',
        state,
        intent: 'link'
      }
    ])('rejects malformed callback %# before storage or provider work', async (body) => {
      await expect(completeTwitch(createCallbackEvent(body))).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: twitchOAuthMessages.invalid
      })

      expect(mocks.consume).not.toHaveBeenCalled()
      assertNoActorWork()
      assertNoProviderWork()
    })

    it('consumes state before provider work and restores the same account with its verified redirect', async () => {
      const event = createCallbackEvent(callbackBody)
      const response = await completeTwitch(event)

      expect(mocks.consume).toHaveBeenCalledWith(event.context.dbHttp, {
        stateHash: hashToken(state),

        actor: {
          userId: null,
          sessionIdHash: hashToken('browser-session')
        }
      })

      expect(mocks.consume.mock.invocationCallOrder[0]).toBeLessThan(Number(mocks.token.mock.invocationCallOrder[0]))
      expect(mocks.token.mock.invocationCallOrder[0]).toBeLessThan(Number(mocks.profile.mock.invocationCallOrder[0]))

      expect(mocks.token).toHaveBeenCalledWith(event, 'oauth-code', {
        clientId: 'client-id',
        clientSecret: 'client-secret'
      })

      expect(mocks.profile).toHaveBeenCalledWith('access-token', 'client-id')
      expect(mocks.findUser).toHaveBeenCalledWith('twitch', 'twitch-id', event)

      expect(response).toStrictEqual({
        ...account,
        redirectTo: '/my-gear'
      })

      expect(mocks.updateSession).toHaveBeenCalledWith(event, { userId })
      expect(mocks.createUser).not.toHaveBeenCalled()
      expect(getResponseHeader(event, 'Cache-Control')).toBe('no-store')
    })

    it('still creates genuinely new Twitch users', async () => {
      mocks.findUser.mockResolvedValue({ userId: null })

      const event = createCallbackEvent(callbackBody)

      await expect(completeTwitch(event)).resolves.toStrictEqual({
        userId,
        email: null,
        isAdmin: false,
        isGuest: false,
        redirectTo: '/my-gear'
      })

      expect(mocks.createUser).toHaveBeenCalledWith('twitch', 'twitch-id', event)

      expect(mocks.updateSession).toHaveBeenCalledWith(event, {
        userId,
        isAdmin: false,
        isGuest: false
      })
    })

    it('rejects unknown, expired, replaced, or consumed state before provider work', async () => {
      mocks.consume.mockRejectedValue(createError({ status: 400 }))
      await expect(completeTwitch(createCallbackEvent(callbackBody))).rejects.toMatchObject({ statusCode: 400 })
      assertNoProviderWork()
    })

    it('passes the actual current identity to atomic consumption', async () => {
      mocks.user.mockResolvedValue(account)
      mocks.session.mockResolvedValue({ id: 'another-session' })
      mocks.consume.mockRejectedValue(createError({ status: 400 }))
      await expect(completeTwitch(createCallbackEvent(callbackBody))).rejects.toMatchObject({ statusCode: 400 })

      expect(mocks.consume).toHaveBeenCalledWith(expect.anything(), {
        stateHash: hashToken(state),

        actor: {
          userId,
          sessionIdHash: hashToken('another-session')
        }
      })

      assertNoProviderWork()
    })

    it('consumes a provider cancellation without exchanging a code', async () => {
      await expect(completeTwitch(createCallbackEvent({
        error: 'access_denied',
        state
      }))).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: twitchOAuthMessages.cancelled
      })

      expect(mocks.consume).toHaveBeenCalledTimes(1)
      assertNoProviderWork()
    })

    it('records other authorization failures and keeps the consumed state invalid', async () => {
      const event = createCallbackEvent({
        error: 'temporarily_unavailable',
        state
      })

      await expect(completeTwitch(event)).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: twitchOAuthMessages.unavailable
      })

      expect(mocks.consume).toHaveBeenCalledTimes(1)
      expect(mocks.issue).not.toHaveBeenCalled()
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('temporarily_unavailable')
      assertNoProviderWork()
    })

    it('keeps the linking branch unavailable after validated consumption', async () => {
      mocks.user.mockResolvedValue(account)

      mocks.consume.mockResolvedValue({
        intent: 'link',
        userId,
        redirectTo: '/account'
      })

      await expect(completeTwitch(createCallbackEvent(callbackBody))).rejects.toMatchObject({ statusCode: 501 })
      expect(mocks.consume).toHaveBeenCalledTimes(1)
      assertNoProviderWork()
    })

    it('fails closed when state storage is unavailable', async () => {
      mocks.consume.mockRejectedValue(new Error('Storage unavailable'))
      await expect(completeTwitch(createCallbackEvent(callbackBody))).rejects.toMatchObject({ statusCode: 503 })
      assertNoProviderWork()
    })

    it('keeps state consumed after a provider failure and redacts callback secrets', async () => {
      mocks.token.mockRejectedValue(new Error(`Provider failed: oauth-code client-secret ${state}`))

      await expect(completeTwitch(createCallbackEvent(callbackBody))).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: twitchOAuthMessages.unavailable
      })

      expect(mocks.consume).toHaveBeenCalledTimes(1)
      expect(mocks.issue).not.toHaveBeenCalled()
      expect(mocks.profile).not.toHaveBeenCalled()
      expect(mocks.updateSession).not.toHaveBeenCalled()

      const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

      expect(telemetry).toContain('Provider failed')
      expect(telemetry).not.toContain('oauth-code')
      expect(telemetry).not.toContain('client-secret')
      expect(telemetry).not.toContain(state)
    })
  })

})
