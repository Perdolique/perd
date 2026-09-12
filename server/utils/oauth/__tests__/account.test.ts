import { afterEach, describe, expect, it, vi } from 'vitest'
import { oauthAccounts, users } from '#server/database/schema'
import { createOAuthUser } from '#server/utils/oauth/account'
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

  it('should create and return an explicit registered account', async () => {
    const userReturningMock = vi.fn(() => [{
      isAdmin: false,
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
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
    })

    expect(dbWebsocket.$client.end).toHaveBeenCalledTimes(1)
  })
})
