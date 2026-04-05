import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteBrandHandler from '#server/api/equipment/brands/[id].delete'
import updateBrandHandler from '#server/api/equipment/brands/[id].patch'
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

interface BrandRecord {
  id: number;
  name: string;
  slug: string;
}

interface MockUpdateDeleteDb {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function createPatchDb({
  updateError,
  updatedBrand
}: {
  updateError?: Error;
  updatedBrand?: BrandRecord;
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
  deletedBrand
}: {
  deleteError?: Error;
  deletedBrand?: BrandRecord;
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

    const { dbHttp, insertContributionValuesMock, updateSetMock } = createPatchDb({
      updatedBrand
    })

    const event = createTestEvent(dbHttp)
    const result = await updateBrandHandler(event)

    expect(result).toStrictEqual(updatedBrand)

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
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 400 when route id is missing', async () => {
    const routeError = h3.createError({ status: 400 })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 404 when the target brand does not exist', async () => {
    const { dbHttp } = createPatchDb({})
    const event = createTestEvent(dbHttp)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test('should return 500 when brand update fails', async () => {
    const { dbHttp } = createPatchDb({
      updateError: new Error('update failed')
    })

    const event = createTestEvent(dbHttp)

    await expect(updateBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to update brand',
      statusCode: 500
    })
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

    const { dbHttp, insertContributionValuesMock } = createDeleteDb({
      deletedBrand
    })

    const event = createTestEvent(dbHttp)

    await deleteBrandHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)

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
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 404 when the target brand does not exist', async () => {
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test.each([
    'msr',
    '12-msr'
  ])('should return 400 when route id has invalid format: %s', async (routeId) => {
    const routeError = h3.createError({
      message: routeId,
      status: 400
    })
    const { dbHttp } = createDeleteDb({})
    const event = createTestEvent(dbHttp)

    getValidatedRouterParamsMock.mockRejectedValue(routeError)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 500 when brand delete fails', async () => {
    const { dbHttp } = createDeleteDb({
      deleteError: new Error('delete failed')
    })

    const event = createTestEvent(dbHttp)

    await expect(deleteBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to delete brand',
      statusCode: 500
    })
  })
})
