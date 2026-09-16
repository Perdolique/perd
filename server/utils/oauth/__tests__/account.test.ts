import { afterEach, describe, expect, it, vi } from 'vitest'
import { oauthAccounts, users } from '#server/database/schema'
import { createOAuthUser, linkOAuthAccount, unlinkOAuthAccount } from '#server/utils/oauth/account'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { createWebSocketClientMock } = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn()
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

describe(createOAuthUser, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps raw database failure diagnostics while returning a safe error', async () => {
    const error = new Error('Database connection refused')

    createWebSocketClientMock.mockImplementationOnce(() => {
      throw error
    })

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure is asserted below.
    })

    await expect(createOAuthUser('twitch', 'account-id', createTestEvent({}))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to create user'
    })

    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('Database connection refused')
  })

  it('preserves a transaction failure when connection cleanup also fails', async () => {
    const transactionError = new Error('Transaction failed')
    const cleanupError = new Error('Connection cleanup failed')

    const dbWebsocket = {
      $client: {
        end: vi.fn().mockRejectedValue(cleanupError)
      },

      transaction: vi.fn().mockRejectedValue(transactionError)
    }

    createWebSocketClientMock.mockReturnValue(dbWebsocket)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Both expected failures are asserted below.
    })

    await expect(createOAuthUser('twitch', 'account-id', createTestEvent({}))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to create user'
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Transaction failed')
    expect(telemetry).toContain('Connection cleanup failed')
    expect(dbWebsocket.$client.end).toHaveBeenCalledTimes(1)
  })

  it('keeps a committed account successful if connection cleanup fails', async () => {
    const cleanupError = new Error('Connection cleanup failed')
    const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'

    const createdUser = {
      userId,
      isAdmin: false,
      isGuest: false,
      sessionVersion: 0
    }

    const dbWebsocket = {
      $client: {
        end: vi.fn().mockRejectedValue(cleanupError)
      },

      transaction: vi.fn().mockResolvedValue(createdUser)
    }

    createWebSocketClientMock.mockReturnValue(dbWebsocket)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected cleanup failure is asserted below.
    })

    await expect(createOAuthUser('twitch', 'account-id', createTestEvent({}))).resolves.toStrictEqual(createdUser)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('Connection cleanup failed')
  })

  it('should create and return an explicit registered account', async () => {
    const userReturningMock = vi.fn(() => [{
      isAdmin: false,
      sessionVersion: 0,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
    }])

    const userValuesMock = vi.fn(() => {
      return { returning: userReturningMock }
    })

    const accountValuesMock = vi.fn()

    const insertMock = vi.fn()
      .mockReturnValueOnce({ values: userValuesMock })
      .mockReturnValueOnce({ values: accountValuesMock })

    const transaction = {
      insert: insertMock,

      query: {
        oauthProviders: {
          findFirst: vi.fn(() => {
            return { id: 7 }
          })
        }
      }
    }

    const dbWebsocket = {
      $client: {
        end: vi.fn()
      },

      transaction: vi.fn(
        async (execute: (value: typeof transaction) => Promise<unknown>) => execute(transaction)
      )
    }

    createWebSocketClientMock.mockReturnValue(dbWebsocket)

    const result = await createOAuthUser(
      'twitch',
      'twitch-account-1',
      createTestEvent({})
    )

    expect(userValuesMock).toHaveBeenCalledWith({})
    expect(insertMock).toHaveBeenNthCalledWith(1, users)
    expect(insertMock).toHaveBeenNthCalledWith(2, oauthAccounts)

    expect(accountValuesMock).toHaveBeenCalledWith({
      accountId: 'twitch-account-1',
      providerId: 7,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
    })

    expect(result).toStrictEqual({
      isAdmin: false,
      isGuest: false,
      sessionVersion: 0,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
    })

    expect(dbWebsocket.$client.end).toHaveBeenCalledTimes(1)
  })
})

interface LinkedAccountRow {
  accountId: string;
  userId: string;
}

function createLinkDatabase(
  userId: string,
  inserted: boolean,
  options: {
    conflicts?: LinkedAccountRow[];
    sessionVersion?: number;
  } = {}
) {
  const { conflicts = [], sessionVersion = 0 } = options

  const lockForUpdateMock = vi.fn().mockResolvedValue([{
    id: userId,
    isAdmin: false,
    sessionVersion
  }])

  const lockWhereMock = vi.fn(() => {
    return { for: lockForUpdateMock }
  })

  const conflictWhereMock = vi.fn().mockResolvedValue(conflicts)

  const lockedFromMock = vi.fn(() => {
    return { where: lockWhereMock }
  })

  const conflictInnerJoinMock = vi.fn(() => {
    return { where: conflictWhereMock }
  })

  const conflictFromMock = vi.fn(() => {
    return { innerJoin: conflictInnerJoinMock }
  })

  const selectMock = vi.fn()
    .mockReturnValueOnce({ from: lockedFromMock })
    .mockReturnValueOnce({ from: conflictFromMock })

  const returningMock = vi.fn().mockResolvedValue(inserted ? [{ id: 'oauth-account-id' }] : [])

  const onConflictDoNothingMock = vi.fn(() => {
    return { returning: returningMock }
  })

  const valuesMock = vi.fn(() => {
    return { onConflictDoNothing: onConflictDoNothingMock }
  })

  const insertMock = vi.fn(() => {
    return { values: valuesMock }
  })

  const transaction = {
    insert: insertMock,
    select: selectMock,

    query: {
      emailCredentials: {
        findFirst: vi.fn().mockResolvedValue({ email: 'verified@example.com' })
      },

      oauthProviders: {
        findFirst: vi.fn().mockResolvedValue({ id: 7 })
      }
    }
  }

  const database = {
    $client: { end: vi.fn().mockResolvedValue(null) },
    transaction: vi.fn(async (execute: (value: typeof transaction) => Promise<unknown>) => execute(transaction))
  }

  createWebSocketClientMock.mockReturnValue(database)

  return {
    database,
    insertMock,
    lockForUpdateMock,
    onConflictDoNothingMock,
    selectMock,
    valuesMock
  }
}

describe(linkOAuthAccount, () => {
  const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'

  afterEach(() => {
    createWebSocketClientMock.mockReset()
    vi.restoreAllMocks()
  })

  it('atomically inserts a new provider identity', async () => {
    const { database, lockForUpdateMock, onConflictDoNothingMock, selectMock, valuesMock } = createLinkDatabase(userId, true)

    await expect(linkOAuthAccount(createTestEvent({}), {
      accountId: 'twitch-account-1',
      provider: 'twitch',
      sessionVersion: 0,
      userId
    })).resolves.toStrictEqual({
      email: 'verified@example.com',
      isAdmin: false,
      isGuest: false,
      userId
    })

    expect(valuesMock).toHaveBeenCalledWith({
      accountId: 'twitch-account-1',
      providerId: 7,
      userId
    })

    expect(onConflictDoNothingMock).toHaveBeenCalledWith()
    expect(lockForUpdateMock).toHaveBeenCalledWith('update')
    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(database.$client.end).toHaveBeenCalledTimes(1)
  })

  it('treats the same existing identity as an idempotent success', async () => {
    createLinkDatabase(userId, false, {
      conflicts: [{
        accountId: 'twitch-account-1',
        userId
      }]
    })

    await expect(linkOAuthAccount(createTestEvent({}), {
      accountId: 'twitch-account-1',
      provider: 'twitch',
      sessionVersion: 0,
      userId
    })).resolves.toMatchObject({ userId })
  })

  it.each([{
    accountId: 'twitch-account-1',

    conflicts: [{
      accountId: 'twitch-account-1',
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477cc'
    }]
  }, {
    accountId: 'twitch-account-2',

    conflicts: [{
      accountId: 'twitch-account-1',
      userId
    }]
  }])('rejects an ownership conflict for $accountId', async ({ accountId, conflicts }) => {
    createLinkDatabase(userId, false, { conflicts })

    await expect(linkOAuthAccount(createTestEvent({}), {
      accountId,
      provider: 'twitch',
      sessionVersion: 0,
      userId
    })).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: twitchOAuthMessages.linkConflict
    })
  })

  it('rejects a revoked session before inserting a provider identity', async () => {
    const { database, insertMock } = createLinkDatabase(userId, true, { sessionVersion: 1 })

    await expect(linkOAuthAccount(createTestEvent({}), {
      accountId: 'twitch-account-1',
      provider: 'twitch',
      sessionVersion: 0,
      userId
    })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: twitchOAuthMessages.invalid
    })

    expect(insertMock).not.toHaveBeenCalled()
    expect(database.$client.end).toHaveBeenCalledTimes(1)
  })

  it('keeps a committed link successful if connection cleanup fails', async () => {
    const { database } = createLinkDatabase(userId, true)
    const cleanupError = new Error('Connection cleanup failed')

    database.$client.end.mockRejectedValue(cleanupError)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected cleanup failure is asserted below.
    })

    await expect(linkOAuthAccount(createTestEvent({}), {
      accountId: 'twitch-account-1',
      provider: 'twitch',
      sessionVersion: 0,
      userId
    })).resolves.toMatchObject({ userId })

    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('Connection cleanup failed')
  })
})

describe(unlinkOAuthAccount, () => {
  it('deletes only the requested provider identity for the user', async () => {
    const whereMock = vi.fn().mockResolvedValue([])

    const deleteMock = vi.fn(() => {
      return { where: whereMock }
    })

    const findProviderMock = vi.fn().mockResolvedValue({ id: 7 })

    const database = {
      delete: deleteMock,

      query: {
        oauthProviders: {
          findFirst: findProviderMock
        }
      }
    }

    await expect(unlinkOAuthAccount(createTestEvent(database), {
      provider: 'twitch',
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
    })).resolves.toBeUndefined()

    expect(findProviderMock).toHaveBeenCalledWith({
      columns: {
        id: true
      },

      where: {
        type: 'twitch'
      }
    })

    expect(deleteMock).toHaveBeenCalledWith(oauthAccounts)
    expect(whereMock).toHaveBeenCalledTimes(1)
  })
})
