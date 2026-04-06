import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteCategoryHandler from '#server/api/equipment/categories/[id].delete'
import updateCategoryHandler from '#server/api/equipment/categories/[id].patch'
import type { CategoryBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockUpdateDeleteTransaction {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
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
  getValidatedRouterParamsMock,
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

function createPatchDb({
  contributionError,
  updateError,
  updatedCategory
}: {
  contributionError?: Error;
  updateError?: Error;
  updatedCategory?: CategoryBaseRecord;
}) {
  const updateReturningMock = vi.fn(() => {
    if (updateError !== undefined) {
      throw updateError
    }

    const updatedRows = updatedCategory === undefined ? [] : [updatedCategory]

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
  deletedCategory
}: {
  contributionError?: Error;
  deleteError?: Error;
  deletedCategory?: CategoryBaseRecord;
}) {
  const deleteReturningMock = vi.fn(() => {
    if (deleteError !== undefined) {
      throw deleteError
    }

    const deletedRows = deletedCategory === undefined ? [] : [deletedCategory]

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

describe('PATCH /api/equipment/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 5
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should update a category and log a contribution', async () => {
    const updatedCategory = {
      id: 5,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }

    const { dbWrite, insertContributionValuesMock, updateSetMock } = createPatchDb({
      updatedCategory
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await updateCategoryHandler(event)

    expect(result).toStrictEqual(updatedCategory)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(updateSetMock).toHaveBeenCalledWith({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'update_category',

      metadata: {
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      },

      targetId: '5',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is invalid', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test.each([
    'sleeping-bags',
    '5-sleeping-bags'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target category does not exist', async () => {
    const { dbWrite } = createPatchDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when category slug already exists', async () => {
    const { dbWrite } = createPatchDb({})

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to update category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after category update', async () => {
    const { dbWrite } = createPatchDb({
      contributionError: new Error('contribution failed'),

      updatedCategory: {
        id: 5,
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to update category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when category update fails', async () => {
    const { dbWrite } = createPatchDb({
      updateError: new Error('update failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to update category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/equipment/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 5
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should delete a category and log a contribution', async () => {
    const deletedCategory = {
      id: 5,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }

    const { dbWrite, insertContributionValuesMock } = createDeleteDb({
      deletedCategory
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await deleteCategoryHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'delete_category',

      metadata: {
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      },

      targetId: '5',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target category does not exist', async () => {
    const { dbWrite } = createDeleteDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test.each([
    'sleeping-bags',
    '5-sleeping-bags'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when contribution logging fails after category delete', async () => {
    const { dbWrite } = createDeleteDb({
      contributionError: new Error('contribution failed'),

      deletedCategory: {
        id: 5,
        name: 'Sleeping Bags',
        slug: 'sleeping-bags'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when category delete fails', async () => {
    const { dbWrite } = createDeleteDb({
      deleteError: new Error('delete failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete category',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
