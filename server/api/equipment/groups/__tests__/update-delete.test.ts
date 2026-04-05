import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteGroupHandler from '#server/api/equipment/groups/[id].delete'
import updateGroupHandler from '#server/api/equipment/groups/[id].patch'
import type { EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
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

interface MockUpdateDeleteDb {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function createPatchDb({
  updateError,
  updatedGroup
}: {
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

  const insertContributionValuesMock = vi.fn()

  const insertMock = vi.fn(() => {
    return {
      values: insertContributionValuesMock
    }
  })

  const dbHttp: MockUpdateDeleteDb = {
    delete: vi.fn(),
    insert: insertMock,
    update: updateMock
  }

  return {
    dbHttp,
    insertContributionValuesMock,
    updateSetMock
  }
}

function createDeleteDb({
  deleteError,
  deletedGroup
}: {
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

  const insertContributionValuesMock = vi.fn()

  const insertMock = vi.fn(() => {
    return {
      values: insertContributionValuesMock
    }
  })

  const dbHttp: MockUpdateDeleteDb = {
    delete: deleteMock,
    insert: insertMock,
    update: vi.fn()
  }

  return {
    dbHttp,
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

    const { dbHttp, insertContributionValuesMock, updateSetMock } = createPatchDb({
      updatedGroup
    })

    const event = createTestEvent(dbHttp)
    const result = await updateGroupHandler(event)

    expect(result).toStrictEqual(updatedGroup)

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

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })
  })

  test('should return 400 when route id is invalid', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test.each([
    'sleep',
    '7-sleep'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 404 when the target group does not exist', async () => {
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test('should return 500 when group update fails', async () => {
    const { dbHttp } = createPatchDb({
      updateError: new Error('update failed')
    })
    const event = createTestEvent(dbHttp)

    await expect(updateGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to update group',
      statusCode: 500
    })
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

    const { dbHttp, insertContributionValuesMock } = createDeleteDb({
      deletedGroup
    })

    const event = createTestEvent(dbHttp)

    await deleteGroupHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)

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

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 404 when the target group does not exist', async () => {
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test.each([
    'sleep',
    '7-sleep'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 500 when group delete fails', async () => {
    const { dbHttp } = createDeleteDb({
      deleteError: new Error('delete failed')
    })
    const event = createTestEvent(dbHttp)

    await expect(deleteGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete group',
      statusCode: 500
    })
  })
})
