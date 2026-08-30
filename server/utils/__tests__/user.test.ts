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

  it('should derive Guest status from the absence of OAuth accounts', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      oauthAccounts: []
    })

    const result = await getSessionUser(createTestEvent(db))

    expect(result).toStrictEqual({
      isAdmin: false,
      isGuest: true,
      userId: 'user-1'
    })

    expect(db.query.users.findFirst).toHaveBeenCalledWith({
      columns: {
        id: true,
        isAdmin: true
      },

      where: {
        id: 'user-1'
      },

      with: {
        oauthAccounts: {
          columns: {
            id: true
          },

          limit: 1
        }
      }
    })
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

  it('should return 403 for a Guest account', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      oauthAccounts: []
    })

    const result = validateRegisteredUser(createTestEvent(db))

    await expect(result).rejects.toMatchObject({ statusCode: 403 })
  })

  it('should return the registered user id', async () => {
    const db = createUserDb({
      id: 'user-1',
      isAdmin: false,
      oauthAccounts: [{ id: 'oauth-account-1' }]
    })

    const result = await validateRegisteredUser(createTestEvent(db))

    expect(result).toBe('user-1')
  })
})
