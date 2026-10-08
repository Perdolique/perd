import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

    readValidatedBodyMock: vi.fn<typeof nuxtServer.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof nuxtServer.setResponseStatus>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

vi.mock(import('nuxt/server'), async () => {
  const actual = await vi.importActual<typeof nuxtServer>('nuxt/server')

  return {
    ...actual,

    async readValidatedBody(...args: Parameters<typeof nuxtServer.readValidatedBody>) {
      return readValidatedBodyMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof nuxtServer.setResponseStatus>) {
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
    createRuntimeWebSocketClient: createWebSocketClientMock
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
    .mockReturnValueOnce({
      values: insertBrandValuesMock
    })
    .mockReturnValueOnce({
      values: insertContributionValuesMock
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

describe('post /api/equipment/brands', () => {
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

  it('should create a brand and log a contribution', async () => {
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

  it('should return 401 when user is unauthenticated', async () => {
    const authError = nuxtServer.createError({ status: 401 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 403 when user is not an admin', async () => {
    const authError = nuxtServer.createError({ status: 403 })
    const event = createTestEvent({})

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 400 when body validation fails', async () => {
    const bodyError = nuxtServer.createError({ status: 400 })
    const event = createTestEvent({})

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each([
    ['name', 'brands_name_key', 'Brand name already exists'],
    ['slug', 'brands_slug_key', 'Brand slug already exists']
  ])('should return 409 when brand %s already exists', async (_field, constraint, statusMessage) => {
    const duplicateError = new Error('duplicate value')

    const databaseError = Object.assign(duplicateError, {
      code: '23505',
      constraint
    })

    const queryError = new Error('query failed', { cause: databaseError })
    const { dbWrite } = createDb()

    dbWrite.transaction.mockRejectedValue(queryError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message, details: { error: unknown; }) => {
      expect(message).toBe('Failed to create brand')
      expect(details.error).toBe(queryError)
    })

    const event = createTestEvent({})

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledTimes(1)
  })

  it('should return 500 when brand creation fails', async () => {
    const failure = new Error('insert failed')

    const { dbWrite } = createDb({
      insertError: failure
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message) => {
      expect(message).toBe('Failed to create brand')
    })

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to create brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledWith('Failed to create brand', { error: failure })
  })

  it('should not expose an unrelated database constraint', async () => {
    const contributionError = new Error('duplicate contribution')

    const failure = Object.assign(contributionError, {
      code: '23505',
      constraint: 'contributions_other_key'
    })

    const { dbWrite } = createDb()

    dbWrite.transaction.mockRejectedValue(failure)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message) => {
      expect(message).toBe('Failed to create brand')
    })

    const event = createTestEvent({})

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to create brand'
    })

    expect(errorLog).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledWith('Failed to create brand', { error: failure })
  })

  it('should return 500 when contribution logging fails after brand creation', async () => {
    const contributionError = new Error('contribution failed')

    const { dbWrite } = createDb({
      contributionError,

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

  it('should retain a committed creation when closing the client fails', async () => {
    const createdBrand = {
      id: 12,
      name: 'MSR',
      slug: 'msr'
    }

    const { dbWrite } = createDb({ createdBrand })
    const closeError = new Error('close failed')

    dbWrite.$client.end.mockRejectedValue(closeError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message) => {
      expect(message).toBe('Failed to close brand write database client')
    })

    const event = createTestEvent({})
    const result = await createBrandHandler(event)

    expect(result).toStrictEqual(createdBrand)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(errorLog).toHaveBeenCalledWith('Failed to close brand write database client', { error: closeError })
  })
})
