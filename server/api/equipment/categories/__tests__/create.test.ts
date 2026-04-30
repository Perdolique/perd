import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import createCategoryHandler from '#server/api/equipment/categories/index.post'
import type { CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockCreateTransaction {
  insert: ReturnType<typeof vi.fn>;
}

interface MockWriteDbClient {
  end: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: MockWriteDbClient;
  transaction: ReturnType<typeof vi.fn>;
}

const {
  createWebSocketClientMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(config: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
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

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial config mock.
vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

function createDb({
  contributionError,
  createdCategory,
  insertError
}: {
  contributionError?: Error;
  createdCategory?: CategoryBaseRecord;
  insertError?: Error;
} = {}) {
  const insertCategoryReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    const createdRows = createdCategory === undefined ? [] : [createdCategory]

    return createdRows
  })

  const insertCategoryValuesMock = vi.fn(() => {
    return {
      returning: insertCategoryReturningMock
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
        values: insertCategoryValuesMock
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

describe('POST /api/equipment/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a category and log a contribution', async () => {
    const createdCategory = {
      id: 5,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }

    const { dbWrite, insertContributionValuesMock } = createDb({
      createdCategory
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await createCategoryHandler(event)

    expect(result).toStrictEqual(createdCategory)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'create_category',

      metadata: {
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      },

      targetId: '5',
      userId: 'user-1'
    })
  })

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when category slug already exists', async () => {
    const { dbWrite } = createDb()

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to create category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when category creation fails', async () => {
    const { dbWrite } = createDb({
      insertError: new Error('insert failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to create category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after category creation', async () => {
    const { dbWrite } = createDb({
      contributionError: new Error('contribution failed'),
      createdCategory: {
        id: 5,
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to create category',
      statusCode: 500
    })

    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when insert returns no created category', async () => {
    const { dbWrite } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to create category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
