import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  getValidatedRouteParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(config: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),

    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>(),
    readValidatedBodyMock: vi.fn<typeof nuxtServer.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof nuxtServer.setResponseStatus>(),
    validateAdminUserMock: vi.fn()
  }
})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {
  return {
    getValidatedRouteParams: getValidatedRouteParamsMock
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

describe('patch /api/equipment/brands/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'MSR',
      slug: 'msr'
    })

    getValidatedRouteParamsMock.mockResolvedValue({
      id: 12
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should update a brand and log a contribution', async () => {
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

  it('should return 400 when route id is invalid', async () => {
    const routeError = nuxtServer.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 400 when route id is missing', async () => {
    const routeError = nuxtServer.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = nuxtServer.createError({
      message: routeId,
      status: 400
    })

    const event = createTestEvent({})

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 404 when the target brand does not exist', async () => {
    const { dbWrite } = createPatchDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['name', 'brands_name_key', 'Brand name already exists'],
    ['slug', 'brands_slug_key', 'Brand slug already exists']
  ])('should return 409 when brand %s already exists', async (_field, constraint, statusMessage) => {
    const { dbWrite } = createPatchDb({})
    const duplicateError = new Error('duplicate value')

    const databaseError = Object.assign(duplicateError, {
      code: '23505',
      constraint
    })

    const queryError = new Error('query failed', { cause: databaseError })

    dbWrite.transaction.mockRejectedValue(queryError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message, details: { error: unknown; }) => {
      expect(message).toBe('Failed to update brand')
      expect(details.error).toBe(queryError)
    })

    const event = createTestEvent({})

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledTimes(1)
  })

  it('should return 500 when contribution logging fails after brand update', async () => {
    const contributionError = new Error('contribution failed')

    const { dbWrite } = createPatchDb({
      contributionError,

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

  it('should return 500 when brand update fails', async () => {
    const updateError = new Error('update failed')

    const { dbWrite } = createPatchDb({
      updateError
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

describe('delete /api/equipment/brands/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouteParamsMock.mockResolvedValue({
      id: 12
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delete a brand and log a contribution', async () => {
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

  it('should return 400 when route id is missing', async () => {
    const routeError = nuxtServer.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 404 when the target brand does not exist', async () => {
    const { dbWrite } = createDeleteDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should return 409 when equipment uses the brand', async () => {
    const { dbWrite } = createDeleteDb({})
    const foreignKeyError = new Error('foreign key violation')

    const databaseError = Object.assign(foreignKeyError, {
      code: '23503',
      constraint: 'equipment_items_brandId_brands_id_fkey'
    })

    const queryError = new Error('query failed', { cause: databaseError })

    dbWrite.transaction.mockRejectedValue(queryError)
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const errorLog = vi.spyOn(console, 'error').mockImplementation((message, details: { error: unknown; }) => {
      expect(message).toBe('Failed to delete brand')
      expect(details.error).toBe(queryError)
    })

    const event = createTestEvent({})

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Brand is used by equipment'
    })

    expect(setResponseStatusMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledTimes(1)
  })

  it.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = nuxtServer.createError({
      message: routeId,
      status: 400
    })

    const event = createTestEvent({})

    getValidatedRouteParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should return 500 when contribution logging fails after brand delete', async () => {
    const contributionError = new Error('contribution failed')

    const { dbWrite } = createDeleteDb({
      contributionError,

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

  it('should return 500 when brand delete fails', async () => {
    const deleteError = new Error('delete failed')

    const { dbWrite } = createDeleteDb({
      deleteError
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
