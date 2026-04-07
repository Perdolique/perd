import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteGroupHandler from '#server/api/equipment/groups/[id].delete'
import updateGroupHandler from '#server/api/equipment/groups/[id].patch'
import type { EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
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
  updatedGroup
}: {
  contributionError?: Error;
  updateError?: Error;
  updatedGroup?: EquipmentGroupBaseRecord;
}) {
  const updateReturningMock = vi.fn(() => {
    if (updateError !== undefined) {
      throw updateError
    }

    const updatedRows = updatedGroup === undefined ? [] : [updatedGroup]

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
  deletedGroup
}: {
  contributionError?: Error;
  deleteError?: Error;
  deletedGroup?: EquipmentGroupBaseRecord;
}) {
  const deleteReturningMock = vi.fn(() => {
    if (deleteError !== undefined) {
      throw deleteError
    }

    const deletedRows = deletedGroup === undefined ? [] : [deletedGroup]

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

describe('PATCH /api/equipment/groups/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleep',
      slug: 'sleep'
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 7
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should update a group and log a contribution', async () => {
    const updatedGroup = {
      id: 7,
      name: 'Sleep',
      slug: 'sleep'
    }

    const { dbWrite, insertContributionValuesMock, updateSetMock } = createPatchDb({
      updatedGroup
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await updateGroupHandler(event)

    expect(result).toStrictEqual(updatedGroup)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(updateSetMock).toHaveBeenCalledWith({
      name: 'Sleep',
      slug: 'sleep'
    })

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'update_group',

      metadata: {
        name: 'Sleep',
        slug: 'sleep'
      },

      targetId: '7',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is invalid', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test.each([
    'sleep',
    '7-sleep'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target group does not exist', async () => {
    const { dbWrite } = createPatchDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when group slug already exists', async () => {
    const { dbWrite } = createPatchDb({})

    dbWrite.transaction.mockRejectedValue(new Error('duplicate slug'))
    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to update group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when contribution logging fails after group update', async () => {
    const { dbWrite } = createPatchDb({
      contributionError: new Error('contribution failed'),
      updatedGroup: {
        id: 7,
        name: 'Sleep',
        slug: 'sleep'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to update group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when group update fails', async () => {
    const { dbWrite } = createPatchDb({
      updateError: new Error('update failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to update group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/equipment/groups/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: 7
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should delete a group and log a contribution', async () => {
    const deletedGroup = {
      id: 7,
      name: 'Sleep',
      slug: 'sleep'
    }

    const { dbWrite, insertContributionValuesMock } = createDeleteDb({
      deletedGroup
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await deleteGroupHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'delete_group',

      metadata: {
        name: 'Sleep',
        slug: 'sleep'
      },

      targetId: '7',
      userId: 'user-1'
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 404 when the target group does not exist', async () => {
    const { dbWrite } = createDeleteDb({})

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test.each([
    'sleep',
    '7-sleep'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const event = createTestEvent({})

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })

    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  test('should return 500 when contribution logging fails after group delete', async () => {
    const { dbWrite } = createDeleteDb({
      contributionError: new Error('contribution failed'),

      deletedGroup: {
        id: 7,
        name: 'Sleep',
        slug: 'sleep'
      }
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  test('should return 500 when group delete fails', async () => {
    const { dbWrite } = createDeleteDb({
      deleteError: new Error('delete failed')
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete group',
      statusCode: 500
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
