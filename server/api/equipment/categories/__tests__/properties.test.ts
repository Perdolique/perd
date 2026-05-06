import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteCategoryPropertyHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/index.delete'
import createCategoryPropertyHandler from '#server/api/equipment/categories/[categoryId]/properties/index.post'
import type { CategoryPropertyBaseRecord, PropertyEnumOptionBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockPropertyTransaction {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
}

interface MockWriteDbClient {
  end: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: MockWriteDbClient;
  transaction: ReturnType<typeof vi.fn>;
}

interface SelectOperation {
  error?: Error;
  rows: unknown;
}

interface InsertOperation {
  error?: Error;
  result?: unknown;
  type: 'returning' | 'values';
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

function createSelectMock(operations: SelectOperation[]) {
  const limitMocks: ReturnType<typeof vi.fn>[] = []

  const whereMock = vi.fn(() => {
    const operation = operations.shift()

    if (operation === undefined) {
      throw new Error('No select operation configured')
    }

    const limitMock = vi.fn(() => {
      if (operation.error !== undefined) {
        throw operation.error
      }

      return operation.rows
    })

    limitMocks.push(limitMock)

    return {
      limit: limitMock
    }
  })

  const fromMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })

  const selectMock = vi.fn(() => {
    return {
      from: fromMock
    }
  })

  return {
    selectMock
  }
}

function createInsertMock(operations: InsertOperation[]) {
  const valuesMocks: ReturnType<typeof vi.fn>[] = []

  const insertMock = vi.fn(() => {
    const operation = operations.shift()

    if (operation === undefined) {
      throw new Error('No insert operation configured')
    }

    const valuesMock = vi.fn(() => {
      if (operation.error !== undefined) {
        throw operation.error
      }

      if (operation.type === 'returning') {
        return {
          returning: vi.fn(() => operation.result)
        }
      }

      return null
    })

    valuesMocks.push(valuesMock)

    return {
      values: valuesMock
    }
  })

  return {
    insertMock,
    valuesMocks
  }
}

function createDeleteMock({
  deletedRows,
  error
}: {
  deletedRows: CategoryPropertyBaseRecord[];
  error?: Error;
}) {
  const returningMock = vi.fn(() => {
    if (error !== undefined) {
      throw error
    }

    return deletedRows
  })

  const whereMock = vi.fn(() => {
    return {
      returning: returningMock
    }
  })

  const deleteMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })

  return {
    deleteMock
  }
}

function createDb(transaction: MockPropertyTransaction) {
  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockPropertyTransaction) => Promise<unknown>) => executeTransaction(transaction)
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

  return dbWrite
}

describe('category property handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('post /api/equipment/categories/[categoryId]/properties', () => {
    beforeEach(() => {
      getValidatedRouterParamsMock.mockResolvedValue({
        categoryId: 5
      })
    })

    test('should create an enum property with inline enum options and log a contribution', async () => {
      const createdProperty: CategoryPropertyBaseRecord = {
        dataType: 'enum',
        id: 11,
        name: 'Fill Type',
        slug: 'fill-type',
        unit: null
      }

      const createdEnumOptions: PropertyEnumOptionBaseRecord[] = [{
        id: 21,
        name: 'Down',
        slug: 'down'
      }, {
        id: 22,
        name: 'Synthetic',
        slug: 'synthetic'
      }]

      readValidatedBodyMock.mockResolvedValue({
        dataType: 'enum',
        enumOptions: createdEnumOptions,
        name: 'Fill Type',
        slug: 'fill-type'
      })

      const { insertMock, valuesMocks } = createInsertMock([{
        result: [createdProperty],
        type: 'returning'
      }, {
        result: createdEnumOptions,
        type: 'returning'
      }, {
        type: 'values'
      }])

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 5
        }]
      }, {
        rows: []
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await createCategoryPropertyHandler(event)

      expect(result).toStrictEqual({
        ...createdProperty,
        enumOptions: createdEnumOptions
      })

      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

      expect(valuesMocks[0]).toHaveBeenCalledWith({
        categoryId: 5,
        dataType: 'enum',
        name: 'Fill Type',
        slug: 'fill-type',
        unit: undefined
      })

      expect(valuesMocks[1]).toHaveBeenCalledWith([{
        name: 'Down',
        propertyId: 11,
        slug: 'down'
      }, {
        name: 'Synthetic',
        propertyId: 11,
        slug: 'synthetic'
      }])

      expect(valuesMocks[2]).toHaveBeenCalledWith({
        action: 'create_category_property',

        metadata: {
          categoryId: 5,
          dataType: 'enum',
          name: 'Fill Type',
          slug: 'fill-type',
          unit: null
        },

        targetId: '11',
        userId: 'user-1'
      })
    })

    test('should create a non-enum property without enum options', async () => {
      const createdProperty: CategoryPropertyBaseRecord = {
        dataType: 'number',
        id: 15,
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      }

      readValidatedBodyMock.mockResolvedValue({
        dataType: 'number',
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      })

      const { insertMock, valuesMocks } = createInsertMock([{
        result: [createdProperty],
        type: 'returning'
      }, {
        type: 'values'
      }])

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 5
        }]
      }, {
        rows: []
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await createCategoryPropertyHandler(event)

      expect(result).toStrictEqual({
        ...createdProperty,
        enumOptions: undefined
      })

      expect(valuesMocks).toHaveLength(2)
    })

    test('should return 404 when category does not exist', async () => {
      readValidatedBodyMock.mockResolvedValue({
        dataType: 'number',
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      })

      const { insertMock } = createInsertMock([])

      const { selectMock } = createSelectMock([{
        rows: []
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createCategoryPropertyHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 409 when category property slug already exists', async () => {
      readValidatedBodyMock.mockResolvedValue({
        dataType: 'number',
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      })

      const { insertMock } = createInsertMock([])

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 5
        }]
      }, {
        rows: [{
          id: 12
        }]
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createCategoryPropertyHandler(event)).rejects.toMatchObject({
        message: 'Category property slug already exists',
        statusCode: 409
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 400 when body validation fails', async () => {
      const bodyError = h3.createError({ status: 400 })
      const event = createTestEvent({})

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createCategoryPropertyHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })

    test('should return 500 when property creation fails unexpectedly', async () => {
      readValidatedBodyMock.mockResolvedValue({
        dataType: 'number',
        name: 'Weight',
        slug: 'weight',
        unit: 'g'
      })

      const { insertMock } = createInsertMock([{
        error: new Error('insert failed'),
        type: 'returning'
      }])

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 5
        }]
      }, {
        rows: []
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createCategoryPropertyHandler(event)).rejects.toMatchObject({
        message: 'Failed to create category property',
        statusCode: 500
      })

      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })
  })

  describe('delete /api/equipment/categories/[categoryId]/properties/[propertyId]', () => {
    beforeEach(() => {
      getValidatedRouterParamsMock.mockResolvedValue({
        categoryId: 5,
        propertyId: 11
      })
    })

    test('should delete a category property and log a contribution', async () => {
      const deletedProperty: CategoryPropertyBaseRecord = {
        dataType: 'enum',
        id: 11,
        name: 'Fill Type',
        slug: 'fill-type',
        unit: null
      }

      const { insertMock, valuesMocks } = createInsertMock([{
        type: 'values'
      }])

      const { deleteMock } = createDeleteMock({
        deletedRows: [deletedProperty]
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await deleteCategoryPropertyHandler(event)

      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)

      expect(valuesMocks[0]).toHaveBeenCalledWith({
        action: 'delete_category_property',

        metadata: {
          categoryId: 5,
          dataType: 'enum',
          name: 'Fill Type',
          slug: 'fill-type',
          unit: null
        },

        targetId: '11',
        userId: 'user-1'
      })
    })

    test('should return 400 when route params validation fails', async () => {
      const routeError = h3.createError({ status: 400 })
      const event = createTestEvent({})

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(deleteCategoryPropertyHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })

    test('should return 404 when category property does not exist', async () => {
      const { insertMock } = createInsertMock([])

      const { deleteMock } = createDeleteMock({
        deletedRows: []
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deleteCategoryPropertyHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 500 when property deletion fails unexpectedly', async () => {
      const { insertMock } = createInsertMock([])

      const { deleteMock } = createDeleteMock({
        deletedRows: [],
        error: new Error('delete failed')
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deleteCategoryPropertyHandler(event)).rejects.toMatchObject({
        message: 'Failed to delete category property',
        statusCode: 500
      })

      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })
  })
})
