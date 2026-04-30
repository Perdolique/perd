import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteBrandHandler from '#server/api/equipment/brands/[id].delete'
import updateBrandHandler from '#server/api/equipment/brands/[id].patch'
import type { BrandBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockUpdateDeleteTransaction {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
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
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(config: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),

    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
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

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    },

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

function createPatchDb({
  contributionError,
  updateError,
  updatedBrand
}: {
  contributionError?: Error;
  updateError?: Error;
  updatedBrand?: BrandBaseRecord;
}) {
  const updateReturningMock = vi.fn(() => {
    if (updateError !== undefined) {
      throw updateError
    }

    const updatedRows = updatedBrand === undefined ? [] : [updatedBrand]

    return updatedRows
  })

  const updateWhereMock = vi.fn(() => {
    return {
      returning: updateReturningMock
    }
  })

  const updateSetMock = vi.fn(() => {
    return {
      where: updateWhereMock
    }
  })

  const updateMock = vi.fn(() => {
    return {
      set: updateSetMock
    }
  })

  const insertContributionValuesMock = vi.fn(() => {
    if (contributionError !== undefined) {
      throw contributionError
    }
  })

  const insertMock = vi.fn(() => {
    return {
      values: insertContributionValuesMock
    }
  })

  const transaction: MockUpdateDeleteTransaction = {
    delete: vi.fn(),
    insert: insertMock,
    update: updateMock
  }

  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockUpdateDeleteTransaction) => Promise<unknown>) => executeTransaction(transaction)
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
    insertContributionValuesMock,
    updateSetMock
  }
}

function createDeleteDb({
  contributionError,
  deleteError,
  deletedBrand
}: {
  contributionError?: Error;
  deleteError?: Error;
  deletedBrand?: BrandBaseRecord;
}) {
  const deleteReturningMock = vi.fn(() => {
    if (deleteError !== undefined) {
      throw deleteError
    }

    const deletedRows = deletedBrand === undefined ? [] : [deletedBrand]

    return deletedRows
  })

  const deleteWhereMock = vi.fn(() => {
    return {
      returning: deleteReturningMock
    }
  })

  const deleteMock = vi.fn(() => {
    return {
      where: deleteWhereMock
    }
  })

  const insertContributionValuesMock = vi.fn(() => {
    if (contributionError !== undefined) {
      throw contributionError
    }
  })

  const insertMock = vi.fn(() => {
    return {
      values: insertContributionValuesMock
    }
  })

  const transaction: MockUpdateDeleteTransaction = {
    delete: deleteMock,
    insert: insertMock,
    update: vi.fn()
  }

  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockUpdateDeleteTransaction) => Promise<unknown>) => executeTransaction(transaction)
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

describe('PATCH /api/equipment/brands/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'MSR',
      slug: 'msr'
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 12
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should update a brand and log a contribution', async () => {
    const updatedBrand = {
      id: 12,
      name: 'MSR',
      slug: 'msr'
    }

    const { dbWrite, insertContributionValuesMock, updateSetMock } = createPatchDb({
      updatedBrand
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await updateBrandHandler(event)

    expect(result).toStrictEqual(updatedBrand)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(updateSetMock).toHaveBeenCalledWith({
      name: 'MSR',
      slug: 'msr'
    })

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'update_brand',

      metadata: {
        name: 'MSR',
        slug: 'msr'
      },

      targetId: '12',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is invalid', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target brand does not exist', async () => {
    const { dbWrite } = createPatchDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when brand slug already exists', async () => {
    const { dbWrite } = createPatchDb({})

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to update brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after brand update', async () => {
    const { dbWrite } = createPatchDb({
      contributionError: new Error('contribution failed'),

      updatedBrand: {
        id: 12,
        name: 'MSR',
        slug: 'msr'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to update brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when brand update fails', async () => {
    const { dbWrite } = createPatchDb({
      updateError: new Error('update failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to update brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/equipment/brands/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 12
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should delete a brand and log a contribution', async () => {
    const deletedBrand = {
      id: 12,
      name: 'MSR',
      slug: 'msr'
    }

    const { dbWrite, insertContributionValuesMock } = createDeleteDb({
      deletedBrand
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await deleteBrandHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'delete_brand',

      metadata: {
        name: 'MSR',
        slug: 'msr'
      },

      targetId: '12',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target brand does not exist', async () => {
    const { dbWrite } = createDeleteDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when contribution logging fails after brand delete', async () => {
    const { dbWrite } = createDeleteDb({
      contributionError: new Error('contribution failed'),

      deletedBrand: {
        id: 12,
        name: 'MSR',
        slug: 'msr'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when brand delete fails', async () => {
    const { dbWrite } = createDeleteDb({
      deleteError: new Error('delete failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete brand',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
