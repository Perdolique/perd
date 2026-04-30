import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deletePropertyEnumOptionHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId]/index.delete'
import createPropertyEnumOptionHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/index.post'
import type { PropertyEnumOptionBaseRecord } from '#server/utils/equipment/base-records'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockEnumOptionTransaction {
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
  const whereMock = vi.fn(() => {
    const operation = operations.shift()

    if (operation === undefined) {
      throw new Error('No select operation configured')
    }

    return {
      limit: vi.fn(() => {
        if (operation.error !== undefined) {
          throw operation.error
        }

        return operation.rows
      })
    }
  })

  const innerJoinMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })

  const fromMock = vi.fn(() => {
    return {
      innerJoin: innerJoinMock,
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
  deletedRows: PropertyEnumOptionBaseRecord[];
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

function createDb(transaction: MockEnumOptionTransaction) {
  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockEnumOptionTransaction) => Promise<unknown>) => executeTransaction(transaction)
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

describe('property enum option handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')
    getValidatedRouterParamsMock.mockResolvedValue({
      categoryId: 5,
      propertyId: 11
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options', () => {
    test('should create a property enum option and log a contribution', async () => {
      const createdOption: PropertyEnumOptionBaseRecord = {
        id: 21,
        name: 'Down',
        slug: 'down'
      }

      readValidatedBodyMock.mockResolvedValue({
        name: 'Down',
        slug: 'down'
      })

      const { insertMock, valuesMocks } = createInsertMock([{
        result: [createdOption],
        type: 'returning'
      }, {
        type: 'values'
      }])

      const { selectMock } = createSelectMock([{
        rows: [{
          dataType: 'enum',
          id: 11
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
      const result = await createPropertyEnumOptionHandler(event)

      expect(result).toStrictEqual(createdOption)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(valuesMocks[0]).toHaveBeenCalledWith({
        name: 'Down',
        propertyId: 11,
        slug: 'down'
      })
      expect(valuesMocks[1]).toHaveBeenCalledWith({
        action: 'create_property_enum_option',

        metadata: {
          categoryId: 5,
          name: 'Down',
          propertyId: 11,
          slug: 'down'
        },

        targetId: '21',
        userId: 'user-1'
      })
    })

    test('should return 404 when category property does not exist', async () => {
      readValidatedBodyMock.mockResolvedValue({
        name: 'Down',
        slug: 'down'
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

      await expect(createPropertyEnumOptionHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 400 when property is not enum', async () => {
      readValidatedBodyMock.mockResolvedValue({
        name: 'Down',
        slug: 'down'
      })

      const { insertMock } = createInsertMock([])
      const { selectMock } = createSelectMock([{
        rows: [{
          dataType: 'text',
          id: 11
        }]
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createPropertyEnumOptionHandler(event)).rejects.toMatchObject({
        message: 'Enum options can only be added to enum properties',
        statusCode: 400
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 409 when property enum option slug already exists', async () => {
      readValidatedBodyMock.mockResolvedValue({
        name: 'Down',
        slug: 'down'
      })

      const { insertMock } = createInsertMock([])
      const { selectMock } = createSelectMock([{
        rows: [{
          dataType: 'enum',
          id: 11
        }]
      }, {
        rows: [{
          id: 21
        }]
      }])

      const dbWrite = createDb({
        delete: vi.fn(),
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createPropertyEnumOptionHandler(event)).rejects.toMatchObject({
        message: 'Property enum option slug already exists',
        statusCode: 409
      })

      expect(insertMock).not.toHaveBeenCalled()
    })

    test('should return 400 when body validation fails', async () => {
      const bodyError = h3.createError({ status: 400 })
      const event = createTestEvent({})

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createPropertyEnumOptionHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId]', () => {
    beforeEach(() => {
      getValidatedRouterParamsMock.mockResolvedValue({
        categoryId: 5,
        optionId: 21,
        propertyId: 11
      })
    })

    test('should delete a property enum option and log a contribution', async () => {
      const deletedOption: PropertyEnumOptionBaseRecord = {
        id: 21,
        name: 'Down',
        slug: 'down'
      }

      const { insertMock, valuesMocks } = createInsertMock([{
        type: 'values'
      }])

      const { selectMock } = createSelectMock([{
        rows: [deletedOption]
      }, {
        rows: []
      }])

      const { deleteMock } = createDeleteMock({
        deletedRows: [deletedOption]
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      await deletePropertyEnumOptionHandler(event)

      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
      expect(valuesMocks[0]).toHaveBeenCalledWith({
        action: 'delete_property_enum_option',

        metadata: {
          categoryId: 5,
          name: 'Down',
          propertyId: 11,
          slug: 'down'
        },

        targetId: '21',
        userId: 'user-1'
      })
    })

    test('should return 404 when category property does not exist', async () => {
      const { insertMock } = createInsertMock([])
      const { selectMock } = createSelectMock([{
        rows: []
      }])

      const { deleteMock } = createDeleteMock({
        deletedRows: []
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deletePropertyEnumOptionHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })

      expect(deleteMock).not.toHaveBeenCalled()
    })

    test('should return 404 when property enum option does not belong to property', async () => {
      const { insertMock } = createInsertMock([])
      const { selectMock } = createSelectMock([{
        rows: []
      }])

      const { deleteMock } = createDeleteMock({
        deletedRows: []
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deletePropertyEnumOptionHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })

      expect(deleteMock).not.toHaveBeenCalled()
    })

    test('should return 409 when property enum option is already used by item values', async () => {
      const deletedOption: PropertyEnumOptionBaseRecord = {
        id: 21,
        name: 'Down',
        slug: 'down'
      }

      const { insertMock } = createInsertMock([])
      const { selectMock } = createSelectMock([{
        rows: [deletedOption]
      }, {
        rows: [{
          id: 99
        }]
      }])

      const { deleteMock } = createDeleteMock({
        deletedRows: []
      })

      const dbWrite = createDb({
        delete: deleteMock,
        insert: insertMock,
        select: selectMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deletePropertyEnumOptionHandler(event)).rejects.toMatchObject({
        message: 'Property enum option is already used by item values',
        statusCode: 409
      })

      expect(deleteMock).not.toHaveBeenCalled()
    })

    test('should return 400 when route params validation fails', async () => {
      const routeError = h3.createError({ status: 400 })
      const event = createTestEvent({})

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(deletePropertyEnumOptionHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })
  })
})
