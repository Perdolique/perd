import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import deleteCategoryHandler from '#server/api/equipment/categories/[categoryId]/index.delete'
import updateCategoryHandler from '#server/api/equipment/categories/[categoryId]/index.patch'
import type { CategoryBaseRecord } from '#server/utils/equipment/base-records'
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

describe('patch /api/equipment/categories/[categoryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      categoryId: 5
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([401, 403])('should reject unauthorized writes with %s before opening a database client', async (status) => {
    const authorizationError = h3.createError({ status })

    validateAdminUserMock.mockRejectedValue(authorizationError)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({ statusCode: status })
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should update a category and log a contribution', async () => {
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

  it('should return 400 when route id is invalid', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each([
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

  it('should return 404 when the target category does not exist', async () => {
    const { dbWrite } = createPatchDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should return 409 when category slug already exists', async () => {
    const duplicateError = new Error('duplicate slug')

    const databaseError = Object.assign(duplicateError, {
      code: '23505',
      constraint: 'equipment_categories_slug_key'
    })

    const queryError = new Error('query failed', { cause: databaseError })
    const { dbWrite, insertContributionValuesMock } = createPatchDb({})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(vi.fn<typeof console.error>())

    dbWrite.transaction.mockRejectedValue(queryError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).rejects.toMatchObject({
      statusMessage: 'Category slug already exists',
      statusCode: 409
    })

    const queryErrorDetails: unknown = expect.stringContaining(queryError.message)

    expect(errorLog).toHaveBeenCalledWith('Failed to update category', queryError, { details: queryErrorDetails })
    expect(insertContributionValuesMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should return 500 when contribution logging fails after category update', async () => {
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

  it('should return 500 when category update fails', async () => {
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

  it('should retain a committed update when closing the client fails', async () => {
    const updatedCategory = {
      id: 5,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }

    const { dbWrite } = createPatchDb({ updatedCategory })
    const closeError = new Error('close failed')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(vi.fn<typeof console.error>())

    dbWrite.$client.end.mockRejectedValue(closeError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateCategoryHandler(event)).resolves.toStrictEqual(updatedCategory)

    const closeErrorDetails: unknown = expect.stringContaining(closeError.message)

    expect(errorLog).toHaveBeenCalledWith('Failed to close category write database client', closeError, { details: closeErrorDetails })
  })
})

describe('delete /api/equipment/categories/[categoryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      categoryId: 5
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([401, 403])('should reject unauthorized writes with %s before opening a database client', async (status) => {
    const authorizationError = h3.createError({ status })

    validateAdminUserMock.mockRejectedValue(authorizationError)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({ statusCode: status })
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should delete a category and log a contribution', async () => {
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

  it('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 404 when the target category does not exist', async () => {
    const { dbWrite } = createDeleteDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it.each([
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

  it('should return 500 when contribution logging fails after category delete', async () => {
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

  it('should return 500 when category delete fails', async () => {
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

  it('should return 409 when equipment uses the category even if closing the client also fails', async () => {
    const referenceError = new Error('category is referenced')

    const databaseError = Object.assign(referenceError, {
      code: '23503',
      constraint: 'equipment_items_categoryId_equipment_categories_id_fkey'
    })

    const queryError = new Error('query failed', { cause: databaseError })
    const closeError = new Error('close failed')
    const { dbWrite, insertContributionValuesMock } = createDeleteDb({ deleteError: queryError })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(vi.fn<typeof console.error>())

    dbWrite.$client.end.mockRejectedValue(closeError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteCategoryHandler(event)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Category is used by equipment'
    })

    expect(insertContributionValuesMock).not.toHaveBeenCalled()
    expect(setResponseStatusMock).not.toHaveBeenCalled()

    const queryErrorDetails: unknown = expect.stringContaining(queryError.message)

    expect(errorLog).toHaveBeenCalledWith('Failed to delete category', queryError, { details: queryErrorDetails })

    const closeErrorDetails: unknown = expect.stringContaining(closeError.message)

    expect(errorLog).toHaveBeenCalledWith('Failed to close category write database client', closeError, { details: closeErrorDetails })
  })

  it('should retain a committed deletion when closing the client fails', async () => {
    const deletedCategory = {
      id: 5,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }

    const { dbWrite } = createDeleteDb({ deletedCategory })
    const closeError = new Error('close failed')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(vi.fn<typeof console.error>())

    dbWrite.$client.end.mockRejectedValue(closeError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await deleteCategoryHandler(event)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)

    const closeErrorDetails: unknown = expect.stringContaining(closeError.message)

    expect(errorLog).toHaveBeenCalledWith('Failed to close category write database client', closeError, { details: closeErrorDetails })
  })
})
