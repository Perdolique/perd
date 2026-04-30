import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import createBrandHandler from '#server/api/equipment/brands/index.post'
import type { BrandBaseRecord } from '#server/utils/equipment/base-records'
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
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
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
  createdBrand,
  insertError
}: {
  contributionError?: Error;
  createdBrand?: BrandBaseRecord;
  insertError?: Error;
} = {}) {
  const insertBrandReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    const createdRows = createdBrand === undefined ? [] : [createdBrand]

    return createdRows
  })

  const insertBrandValuesMock = vi.fn(() => {
    return {
      returning: insertBrandReturningMock
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
        values: insertBrandValuesMock
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

describe('POST /api/equipment/brands', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'MSR',
      slug: 'msr'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a brand and log a contribution', async () => {
    const createdBrand = {
      id: 12,
      name: 'MSR',
      slug: 'msr'
    }

    const { dbWrite, insertContributionValuesMock } = createDb({
      createdBrand
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await createBrandHandler(event)

    expect(result).toStrictEqual(createdBrand)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'create_brand',

      metadata: {
        name: 'MSR',
        slug: 'msr'
      },

      targetId: '12',
      userId: 'user-1'
    })
  })

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when brand slug already exists', async () => {
    const { dbWrite } = createDb()

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to create brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when brand creation fails', async () => {
    const { dbWrite } = createDb({
      insertError: new Error('insert failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to create brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after brand creation', async () => {
    const { dbWrite } = createDb({
      contributionError: new Error('contribution failed'),

      createdBrand: {
        id: 12,
        name: 'MSR',
        slug: 'msr'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to create brand',
      statusCode: 500
    })

    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
