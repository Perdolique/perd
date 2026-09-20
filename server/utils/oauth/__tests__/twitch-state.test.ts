import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTwitchOAuthContext } from '#server/utils/oauth/twitch-state'
import { hashToken } from '#server/utils/auth/password'
import { createTestEvent } from '~~/test-utils/create-test-event'

const mocks = vi.hoisted(() => {
  return {
    session: vi.fn(),
    clear: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    useAppSession: mocks.session,
    clearAppSession: mocks.clear
  }
})

describe('twitch OAuth session binding', () => {
  beforeEach(() => vi.resetAllMocks())

  it('binds an anonymous attempt without creating a user', async () => {
    mocks.session.mockResolvedValue({
      id: 'anonymous-session',
      data: {}
    })

    await expect(getTwitchOAuthContext(createTestEvent({}))).resolves.toStrictEqual({
      actor: {
        userId: null,
        sessionIdHash: hashToken('anonymous-session')
      },

      sessionVersion: 0,

      user: {
        email: null,
        isAdmin: false,
        isGuest: false,
        isTwitchLinked: false,
        userId: null
      }
    })
  })

  it('binds a valid guest to the same existing user and session', async () => {
    mocks.session.mockResolvedValue({
      id: 'guest-session',

      data: {
        userId: 'guest-user',
        sessionVersion: 2
      }
    })

    const storedUser = {
      id: 'guest-user',
      isAdmin: false,
      sessionVersion: 2,
      emailCredential: null,
      oauthAccounts: []
    }

    const findFirst = vi.fn().mockResolvedValue(storedUser)
    const database = { query: { users: { findFirst } } }

    await expect(getTwitchOAuthContext(createTestEvent(database))).resolves.toMatchObject({
      actor: {
        userId: 'guest-user',
        sessionIdHash: hashToken('guest-session')
      },

      sessionVersion: 2,

      user: {
        isGuest: true,
        isTwitchLinked: false,
        userId: 'guest-user'
      }
    })

    expect(mocks.clear).not.toHaveBeenCalled()
  })

  it.each([undefined, {
    id: 'revoked-user',
    isAdmin: false,
    sessionVersion: 3
  }])('never reuses a deleted or revoked user binding %#', async (storedUser) => {
    mocks.session.mockResolvedValueOnce({
      id: 'old-session',

      data: {
        userId: 'revoked-user',
        sessionVersion: 2
      }
    })

    mocks.session.mockResolvedValue({
      id: 'replacement-session',
      data: {}
    })

    const findFirst = vi.fn().mockResolvedValue(storedUser)
    const database = { query: { users: { findFirst } } }

    await expect(getTwitchOAuthContext(createTestEvent(database))).resolves.toMatchObject({
      actor: {
        userId: null,
        sessionIdHash: hashToken('replacement-session')
      },

      user: {
        isTwitchLinked: false,
        userId: null
      }
    })

    expect(mocks.clear).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing browser identity', async () => {
    mocks.session.mockResolvedValue({ data: {} })
    await expect(getTwitchOAuthContext(createTestEvent({}))).rejects.toMatchObject({ statusCode: 400 })
  })
})
