import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionUser, validateRegisteredUser } from '#server/utils/user'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { clearAppSessionMock, useAppSessionMock } = vi.hoisted(() => {
  return {
    clearAppSessionMock: vi.fn(),
    useAppSessionMock: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    clearAppSession: clearAppSessionMock,
    useAppSession: useAppSessionMock
  }
})

function createUserDb(foundUser?: unknown) {
  return {
    query: {
      users: {
        findFirst: vi.fn(() => foundUser)
      }
    }
  }
}

describe('user session helpers', () => {
  beforeEach(() => {
    useAppSessionMock.mockResolvedValue({
      data: {
        userId: 'user-1'
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should derive Guest status from the absence of OAuth accounts and verified email', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      sessionVersion: 0,
      oauthAccounts: []
    })

    const result = await getSessionUser(createTestEvent(db))

    expect(result).toStrictEqual({
      email: null,
      isAdmin: false,
      isGuest: true,
      userId: 'user-1'
    })

    expect(db.query.users.findFirst).toHaveBeenCalledWith({
      columns: {
        id: true,
        isAdmin: true,
        sessionVersion: true
      },

      where: {
        id: 'user-1'
      },

      with: {
        emailCredential: { columns: { email: true } },

        oauthAccounts: {
          columns: {
            id: true
          },

          limit: 1
        }
      }
    })
  })

  it('should expose only verified email and treat an email-only account as registered', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      sessionVersion: 0,
      oauthAccounts: [],
      emailCredential: { email: 'trip@example.com' }
    })

    const event = createTestEvent(db)

    await expect(getSessionUser(event)).resolves.toStrictEqual({
      userId: 'user-1',
      isAdmin: false,
      isGuest: false,
      email: 'trip@example.com'
    })

    await expect(validateRegisteredUser(event)).resolves.toBe('user-1')
  })

  it('should return 401 without a valid session user', async () => {
    useAppSessionMock.mockResolvedValue({ data: {} })

    const result = validateRegisteredUser(createTestEvent(createUserDb()))

    await expect(result).rejects.toMatchObject({ statusCode: 401 })
  })

  it('should return 401 when the session user no longer exists', async () => {
    const event = createTestEvent(createUserDb())
    const result = validateRegisteredUser(event)

    await expect(result).rejects.toMatchObject({ statusCode: 401 })
    expect(clearAppSessionMock).toHaveBeenCalledWith(event)
  })

  it('should clear a session whose version was revoked', async () => {
    useAppSessionMock.mockResolvedValue({
      data: {
        sessionVersion: 2,
        userId: 'user-1'
      }
    })

    const event = createTestEvent(createUserDb({
      id: 'user-1',
      isAdmin: false,
      oauthAccounts: [{ id: 'oauth-account-1' }],
      sessionVersion: 3
    }))

    await expect(getSessionUser(event)).resolves.toStrictEqual({
      email: null,
      isAdmin: false,
      isGuest: false,
      userId: null
    })

    expect(clearAppSessionMock).toHaveBeenCalledWith(event)
  })

  it('should return 403 for a Guest account', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      sessionVersion: 0,
      oauthAccounts: []
    })

    const result = validateRegisteredUser(createTestEvent(db))

    await expect(result).rejects.toMatchObject({ statusCode: 403 })
  })

  it('should return the registered user id', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      sessionVersion: 0,
      oauthAccounts: [{ id: 'oauth-account-1' }]
    })

    const result = await validateRegisteredUser(createTestEvent(db))

    expect(result).toBe('user-1')
  })
})
