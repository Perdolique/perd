import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import createGroupHandler from '#server/api/equipment/groups/index.post'
import type { EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockCreateTransaction {
  insert: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: {
    end: ReturnType<typeof vi.fn>;
  };

  transaction: ReturnType<typeof vi.fn>;
}

const {
  createWebSocketClientMock,
  getRuntimeDatabaseConfigMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(config: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),

    getRuntimeDatabaseConfigMock: vi.fn(() => {
      return {
        databaseUrl: 'postgres://test',
        isLocalDatabase: false
      }
    }),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateAdminUserMock: vi.fn()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async readValidatedBody(...args: Parameters<typeof h3.readValidatedBody>) {
      return readValidatedBodyMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    getRuntimeDatabaseConfig: getRuntimeDatabaseConfigMock
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial database mock.
vi.mock(import('#server/utils/database'), () => {
  return {
    createWebSocketClient: createWebSocketClientMock
  }
})

function createDb({
  contributionError,
  createdGroup,
  insertError
}: {
  contributionError?: Error;
  createdGroup?: EquipmentGroupBaseRecord;
  insertError?: Error;
} = {}) {
  const insertGroupReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    const createdRows = createdGroup === undefined ? [] : [createdGroup]

    return createdRows
  })

  const insertGroupValuesMock = vi.fn(() => {
    return {
      returning: insertGroupReturningMock
    }
  })

  const insertContributionValuesMock = vi.fn(() => {
    if (contributionError !== undefined) {
      throw contributionError
    }
  })

  const insertMock = vi.fn()

  insertMock
    .mockImplementationOnce(() => {
      return {
        values: insertGroupValuesMock
      }
    })
    .mockImplementationOnce(() => {
      return {
        values: insertContributionValuesMock
      }
    })

  const transaction: MockCreateTransaction = {
    insert: insertMock
  }

  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockCreateTransaction) => Promise<unknown>) => executeTransaction(transaction)
  )

  const endMock = vi.fn(async () => {
    await Promise.resolve()
  })

  const dbWrite: MockWriteDb = {
    $client: {
      end: endMock
    },

    transaction: transactionMock
  }

  return {
    dbWrite,
    insertContributionValuesMock
  }
}

describe('POST /api/equipment/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleep',
      slug: 'sleep'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a group and log a contribution', async () => {
    const createdGroup = {
      id: 7,
      name: 'Sleep',
      slug: 'sleep'
    }

    const { dbWrite, insertContributionValuesMock } = createDb({
      createdGroup
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await createGroupHandler(event)

    expect(result).toStrictEqual(createdGroup)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'create_group',

      metadata: {
        name: 'Sleep',
        slug: 'sleep'
      },

      targetId: '7',
      userId: 'user-1'
    })
  })

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when group slug already exists', async () => {
    const { dbWrite } = createDb()

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to create group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when group creation fails', async () => {
    const { dbWrite } = createDb({
      insertError: new Error('insert failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to create group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after group creation', async () => {
    const { dbWrite } = createDb({
      contributionError: new Error('contribution failed'),

      createdGroup: {
        id: 7,
        name: 'Sleep',
        slug: 'sleep'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to create group',
      statusCode: 500
    })

    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
