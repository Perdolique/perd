import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deletePackingListHandler from '#server/api/user/packing-lists/[id].delete'
import deletePackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/[entry-id].delete'
import updatePackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/[entry-id].patch'
import createPackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/index.post'
import getPackingListHandler from '#server/api/user/packing-lists/[id].get'
import updatePackingListHandler from '#server/api/user/packing-lists/[id].patch'
import listPackingListsHandler from '#server/api/user/packing-lists/index.get'
import createPackingListHandler from '#server/api/user/packing-lists/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  createWebSocketClientMock,
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(event: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateSessionUserMock: vi.fn<(event: unknown) => Promise<string>>()
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

vi.mock(import('#server/utils/session'), () => {
  return {
    validateSessionUser: validateSessionUserMock
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial config mock.
vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

interface MockWriteDbClient {
  end: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: MockWriteDbClient;
  transaction: ReturnType<typeof vi.fn>;
}

interface PackingListFindManyConfig {
  columns: unknown;
  orderBy: PackingListOrderByConfig;
  where: unknown;
  with: unknown;
}

interface PackingListFindFirstConfig {
  columns: unknown;
  where: unknown;
  with: PackingListWithEntriesConfig;
}

interface PackingListWithEntriesConfig {
  entries: PackingListEntriesConfig;
}

interface PackingListEntriesConfig {
  columns: unknown;
  orderBy: PackingListEntryOrderByConfig;
  with?: unknown;
}

interface PackingListOrderByConfig {
  createdAt: 'desc';
  id: 'desc';
}

interface PackingListEntryOrderByConfig {
  createdAt: 'asc';
  id: 'asc';
}

interface SelectOperation {
  error?: Error;
  rows: unknown[];
}

interface InsertOperation {
  error?: Error;
  rows: unknown[];
}

interface UpdateOperation {
  error?: Error;
  rows: unknown[];
}

interface DeleteOperation {
  error?: Error;
  rows: unknown[];
}

function createListDb(rows: unknown[]) {
  let lastFindManyConfig: PackingListFindManyConfig | null = null
  const findManyMock = vi.fn((config: PackingListFindManyConfig) => {
    lastFindManyConfig = config

    return rows
  })

  return {
    getLastFindManyConfig() {
      if (lastFindManyConfig === null) {
        throw new Error('Expected packingLists.findMany to be called')
      }

      return lastFindManyConfig
    },

    query: {
      packingLists: {
        findMany: findManyMock
      }
    }
  }
}

function createDetailDb(row?: unknown) {
  let lastFindFirstConfig: PackingListFindFirstConfig | null = null
  const findFirstMock = vi.fn((_config: PackingListFindFirstConfig) => row)

  return {
    getLastFindFirstConfig() {
      if (lastFindFirstConfig === null) {
        throw new Error('Expected packingLists.findFirst to be called')
      }

      return lastFindFirstConfig
    },

    query: {
      packingLists: {
        findFirst(config: PackingListFindFirstConfig) {
          lastFindFirstConfig = config

          return findFirstMock(config)
        }
      }
    }
  }
}

function createCreateDb(createdRow?: unknown) {
  const insertReturningMock = vi.fn(() => createdRow === undefined ? [] : [createdRow])
  const insertValuesMock = vi.fn(() => {
    return {
      returning: insertReturningMock
    }
  })

  return {
    dbHttp: {
      insert: vi.fn(() => {
        return {
          values: insertValuesMock
        }
      })
    },
    insertValuesMock
  }
}

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

  const chain = {
    innerJoin: vi.fn(() => chain),
    where: whereMock
  }

  const fromMock = vi.fn(() => chain)

  const selectMock = vi.fn(() => {
    return {
      from: fromMock
    }
  })

  return {
    limitMocks,
    selectMock,
    whereMock
  }
}

function createInsertMock(operation: InsertOperation) {
  const returningMock = vi.fn(() => {
    if (operation.error !== undefined) {
      throw operation.error
    }

    return operation.rows
  })

  const valuesMock = vi.fn(() => {
    return {
      returning: returningMock
    }
  })

  const insertMock = vi.fn(() => {
    return {
      values: valuesMock
    }
  })

  return {
    insertMock,
    valuesMock
  }
}

function createUpdateMock(operations: UpdateOperation[]) {
  const setMocks: ReturnType<typeof vi.fn>[] = []
  const whereMocks: ReturnType<typeof vi.fn>[] = []

  const updateMock = vi.fn(() => {
    const operation = operations.shift()

    if (operation === undefined) {
      throw new Error('No update operation configured')
    }

    const returningMock = vi.fn(() => {
      if (operation.error !== undefined) {
        throw operation.error
      }

      return operation.rows
    })

    const whereMock = vi.fn(() => {
      return {
        returning: returningMock
      }
    })

    const setMock = vi.fn(() => {
      return {
        where: whereMock
      }
    })

    setMocks.push(setMock)
    whereMocks.push(whereMock)

    return {
      set: setMock
    }
  })

  return {
    setMocks,
    updateMock,
    whereMocks
  }
}

function createDeleteEntryMock(operation: DeleteOperation) {
  const returningMock = vi.fn(() => {
    if (operation.error !== undefined) {
      throw operation.error
    }

    return operation.rows
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
    deleteMock,
    whereMock
  }
}

function createEntryMutationDb(transaction: {
  delete?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}) {
  const transactionMock = vi.fn(async (executeTransaction: (db: typeof transaction) => Promise<unknown>) => executeTransaction(transaction))

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

function createUpdateDb(updatedRow?: unknown) {
  const updateReturningMock = vi.fn(() => updatedRow === undefined ? [] : [updatedRow])
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

  return {
    dbHttp: {
      update: vi.fn(() => {
        return {
          set: updateSetMock
        }
      })
    },
    updateSetMock,
    updateWhereMock
  }
}

function createDeleteDb(deletedRow?: unknown) {
  const deleteReturningMock = vi.fn(() => deletedRow === undefined ? [] : [deletedRow])
  const deleteWhereMock = vi.fn(() => {
    return {
      returning: deleteReturningMock
    }
  })

  return {
    dbHttp: {
      delete: vi.fn(() => {
        return {
          where: deleteWhereMock
        }
      })
    },
    deleteWhereMock
  }
}

describe('user packing list handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    createWebSocketClientMock.mockImplementation(() => {
      throw new Error('createWebSocketClient mock is not configured')
    })

    validateSessionUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    readValidatedBodyMock.mockResolvedValue({
      name: 'Alpine weekend'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get /api/user/packing-lists', () => {
    test('should return packing lists scoped to the current user', async () => {
      const rows = [{
        createdAt: '2026-04-03T09:00:00.000Z',
        entries: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
        }, {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'
        }],
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }]

      const expectedRows = [{
        createdAt: '2026-04-03T09:00:00.000Z',
        entryCount: 2,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }]

      const dbHttp = createListDb(rows)
      const event = createTestEvent(dbHttp)
      const result = await listPackingListsHandler(event)

      expect(result).toStrictEqual(expectedRows)
      expect(dbHttp.query.packingLists.findMany).toHaveBeenCalledTimes(1)

      const findManyConfig = dbHttp.getLastFindManyConfig()

      expect(findManyConfig).toMatchObject({
        columns: {
          createdAt: true,
          id: true,
          name: true,
          updatedAt: true
        },

        where: {
          userId: 'user-1'
        },

        with: {
          entries: {
            columns: {
              id: true
            }
          }
        }
      })

      expect(findManyConfig.orderBy).toStrictEqual({
        createdAt: 'desc',
        id: 'desc'
      })
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const event = createTestEvent(createListDb([]))

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(listPackingListsHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('get /api/user/packing-lists/[id]', () => {
    test('should return an owned packing list', async () => {
      const row = {
        createdAt: '2026-04-03T09:00:00.000Z',
        entries: [{
          createdAt: '2026-04-03T09:01:00.000Z',
          customName: 'Rain jacket',
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
          isPacked: false,
          updatedAt: '2026-04-03T09:01:00.000Z',
          userEquipment: null
        }, {
          createdAt: '2026-04-03T09:02:00.000Z',
          customName: null,
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
          isPacked: true,
          updatedAt: '2026-04-03T09:02:00.000Z',

          userEquipment: {
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',

            item: {
              brand: {
                name: 'MSR'
              },

              category: {
                name: 'Stoves'
              },

              name: 'PocketRocket Deluxe'
            }
          }
        }],
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }

      const expectedRow = {
        createdAt: '2026-04-03T09:00:00.000Z',
        entries: [{
          createdAt: '2026-04-03T09:01:00.000Z',
          customName: 'Rain jacket',
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
          isPacked: false,
          source: 'custom',
          updatedAt: '2026-04-03T09:01:00.000Z'
        }, {
          createdAt: '2026-04-03T09:02:00.000Z',
          customName: null,
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

          inventory: {
            brand: 'MSR',
            category: 'Stoves',
            inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
            itemName: 'PocketRocket Deluxe'
          },

          isPacked: true,
          source: 'inventory',
          updatedAt: '2026-04-03T09:02:00.000Z'
        }],
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }

      const dbHttp = createDetailDb(row)
      const event = createTestEvent(dbHttp)
      const result = await getPackingListHandler(event)

      expect(result).toStrictEqual(expectedRow)
      const findFirstConfig = dbHttp.getLastFindFirstConfig()

      expect(findFirstConfig).toMatchObject({
        columns: {
          createdAt: true,
          id: true,
          name: true,
          updatedAt: true
        },

        where: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          userId: 'user-1'
        },

        with: {
          entries: {
            columns: {
              createdAt: true,
              customName: true,
              id: true,
              isPacked: true,
              updatedAt: true
            },

            with: {
              userEquipment: {
                columns: {
                  id: true
                },

                with: {
                  item: {
                    columns: {
                      name: true
                    },

                    with: {
                      brand: {
                        columns: {
                          name: true
                        }
                      },

                      category: {
                        columns: {
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })

      expect(findFirstConfig.with.entries.orderBy).toStrictEqual({
        createdAt: 'asc',
        id: 'asc'
      })
    })

    test('should return 404 when the packing list is missing or unowned', async () => {
      const dbHttp = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(getPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const dbHttp = createDetailDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(getPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('post /api/user/packing-lists', () => {
    test('should create a packing list for the current user', async () => {
      const createdRow = {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }

      const { dbHttp, insertValuesMock } = createCreateDb(createdRow)
      const event = createTestEvent(dbHttp)
      const result = await createPackingListHandler(event)

      expect(result).toStrictEqual(createdRow)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(insertValuesMock).toHaveBeenCalledWith({
        name: 'Alpine weekend',
        userId: 'user-1'
      })
    })

    test('should return 400 when body validation fails', async () => {
      const bodyError = h3.createError({ status: 400 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(createPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('patch /api/user/packing-lists/[id]', () => {
    test('should rename an owned packing list', async () => {
      const updatedRow = {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'Storm kit',
        updatedAt: '2026-04-04T09:00:00.000Z'
      }

      readValidatedBodyMock.mockResolvedValue({
        name: 'Storm kit'
      })

      const { dbHttp, updateSetMock, updateWhereMock } = createUpdateDb(updatedRow)
      const event = createTestEvent(dbHttp)
      const result = await updatePackingListHandler(event)

      expect(result).toStrictEqual(updatedRow)
      expect(updateSetMock).toHaveBeenCalledWith({
        name: 'Storm kit'
      })
      expect(updateWhereMock).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the packing list is missing or unowned', async () => {
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    test('should return 400 when route params validation fails', async () => {
      const routeError = h3.createError({ status: 400 })
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('delete /api/user/packing-lists/[id]', () => {
    test('should delete an owned packing list', async () => {
      const { dbHttp, deleteWhereMock } = createDeleteDb({
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      const event = createTestEvent(dbHttp)

      await expect(deletePackingListHandler(event)).resolves.toBeUndefined()

      expect(deleteWhereMock).toHaveBeenCalledTimes(1)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    })

    test('should return 404 when the packing list is missing or unowned', async () => {
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      await expect(deletePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(deletePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('post /api/user/packing-lists/[id]/entries', () => {
    test('should create a custom entry and touch the parent packing list', async () => {
      const createdEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: 'Rain jacket',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        isPacked: false,
        updatedAt: '2026-04-03T09:01:00.000Z'
      }

      readValidatedBodyMock.mockResolvedValue({
        customName: 'Rain jacket'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }])
      const { insertMock, valuesMock } = createInsertMock({
        rows: [createdEntry]
      })
      const { setMocks, updateMock } = createUpdateMock([{
        rows: [{
          updatedAt: '2026-04-03T09:02:00.000Z'
        }]
      }])
      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await createPackingListEntryHandler(event)

      expect(result).toStrictEqual({
        entry: {
          ...createdEntry,
          source: 'custom'
        },
        packingListUpdatedAt: '2026-04-03T09:02:00.000Z'
      })
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(valuesMock).toHaveBeenCalledWith({
        customName: 'Rain jacket',
        packingListId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userEquipmentId: undefined
      })
      expect(selectMock).toHaveBeenCalledTimes(1)
      expect(setMocks[0]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should create an inventory entry and touch the parent packing list', async () => {
      const createdEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: null,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
        isPacked: false,
        updatedAt: '2026-04-03T09:01:00.000Z'
      }

      readValidatedBodyMock.mockResolvedValue({
        inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }, {
        rows: [{
          brand: 'MSR',
          category: 'Stoves',
          inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
          itemName: 'PocketRocket Deluxe'
        }]
      }])
      const { insertMock, valuesMock } = createInsertMock({
        rows: [createdEntry]
      })
      const { setMocks, updateMock } = createUpdateMock([{
        rows: [{
          updatedAt: '2026-04-03T09:02:00.000Z'
        }]
      }])
      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await createPackingListEntryHandler(event)

      expect(result).toStrictEqual({
        entry: {
          ...createdEntry,

          inventory: {
            brand: 'MSR',
            category: 'Stoves',
            inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
            itemName: 'PocketRocket Deluxe'
          },

          source: 'inventory'
        },
        packingListUpdatedAt: '2026-04-03T09:02:00.000Z'
      })
      expect(valuesMock).toHaveBeenCalledWith({
        customName: undefined,
        packingListId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userEquipmentId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })
      expect(selectMock).toHaveBeenCalledTimes(2)
      expect(setMocks[0]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the inventory row is missing or unowned', async () => {
      readValidatedBodyMock.mockResolvedValue({
        inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }, {
        rows: []
      }])
      const { insertMock } = createInsertMock({
        rows: []
      })
      const { updateMock } = createUpdateMock([])
      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
      expect(insertMock).not.toHaveBeenCalled()
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 409 when the inventory item is already in the pack', async () => {
      readValidatedBodyMock.mockResolvedValue({
        inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }, {
        rows: [{
          brand: 'MSR',
          category: 'Stoves',
          inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
          itemName: 'PocketRocket Deluxe'
        }]
      }])
      const { insertMock } = createInsertMock({
        error: Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505'
        }),
        rows: []
      })
      const { updateMock } = createUpdateMock([])
      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        message: 'Inventory item is already in this pack',
        statusCode: 409
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the parent packing list is missing or unowned', async () => {
      readValidatedBodyMock.mockResolvedValue({
        customName: 'Rain jacket'
      })

      const { selectMock } = createSelectMock([{
        rows: []
      }])
      const { insertMock } = createInsertMock({
        rows: []
      })
      const { updateMock } = createUpdateMock([])
      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
      expect(insertMock).not.toHaveBeenCalled()
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 400 when create body validation fails before opening a write client', async () => {
      const bodyError = h3.createError({ status: 400 })
      const event = createTestEvent({})

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })
  })

  describe('patch /api/user/packing-lists/[id]/entries/[entryId]', () => {
    test('should toggle a custom entry and touch the parent packing list', async () => {
      const updatedEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: 'Rain jacket',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        isPacked: true,
        updatedAt: '2026-04-03T09:03:00.000Z',
        userEquipmentId: null
      }

      getValidatedRouterParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })
      readValidatedBodyMock.mockResolvedValue({
        isPacked: true
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }])
      const { setMocks, updateMock } = createUpdateMock([{
        rows: [updatedEntry]
      }, {
        rows: [{
          updatedAt: '2026-04-03T09:04:00.000Z'
        }]
      }])
      const dbWrite = createEntryMutationDb({
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await updatePackingListEntryHandler(event)

      expect(result).toStrictEqual({
        entry: {
          createdAt: '2026-04-03T09:01:00.000Z',
          customName: 'Rain jacket',
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
          isPacked: true,
          source: 'custom',
          updatedAt: '2026-04-03T09:03:00.000Z'
        },
        packingListUpdatedAt: '2026-04-03T09:04:00.000Z'
      })
      expect(setMocks[0]).toHaveBeenCalledWith({
        isPacked: true
      })
      expect(setMocks[1]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should toggle an inventory entry and keep its inventory metadata', async () => {
      const updatedEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: null,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
        isPacked: true,
        updatedAt: '2026-04-03T09:03:00.000Z',
        userEquipmentId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      }

      getValidatedRouterParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })
      readValidatedBodyMock.mockResolvedValue({
        isPacked: true
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }, {
        rows: [{
          brand: 'MSR',
          category: 'Stoves',
          inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
          itemName: 'PocketRocket Deluxe'
        }]
      }])
      const { setMocks, updateMock } = createUpdateMock([{
        rows: [updatedEntry]
      }, {
        rows: [{
          updatedAt: '2026-04-03T09:04:00.000Z'
        }]
      }])
      const dbWrite = createEntryMutationDb({
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await updatePackingListEntryHandler(event)

      expect(result).toStrictEqual({
        entry: {
          createdAt: '2026-04-03T09:01:00.000Z',
          customName: null,
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

          inventory: {
            brand: 'MSR',
            category: 'Stoves',
            inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
            itemName: 'PocketRocket Deluxe'
          },

          isPacked: true,
          source: 'inventory',
          updatedAt: '2026-04-03T09:03:00.000Z'
        },
        packingListUpdatedAt: '2026-04-03T09:04:00.000Z'
      })
      expect(setMocks[0]).toHaveBeenCalledWith({
        isPacked: true
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the entry is missing from the owned packing list', async () => {
      getValidatedRouterParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })
      readValidatedBodyMock.mockResolvedValue({
        isPacked: true
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }])
      const { updateMock } = createUpdateMock([{
        rows: []
      }])
      const dbWrite = createEntryMutationDb({
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(updatePackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })
  })

  describe('delete /api/user/packing-lists/[id]/entries/[entryId]', () => {
    test('should delete a custom entry and touch the parent packing list', async () => {
      getValidatedRouterParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }])
      const { deleteMock, whereMock } = createDeleteEntryMock({
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
        }]
      })
      const { updateMock } = createUpdateMock([{
        rows: [{
          updatedAt: '2026-04-03T09:05:00.000Z'
        }]
      }])
      const dbWrite = createEntryMutationDb({
        delete: deleteMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await deletePackingListEntryHandler(event)

      expect(result).toStrictEqual({
        deletedEntryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        packingListUpdatedAt: '2026-04-03T09:05:00.000Z'
      })
      expect(whereMock).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the parent packing list is missing or unowned', async () => {
      getValidatedRouterParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      const { selectMock } = createSelectMock([{
        rows: []
      }])
      const { deleteMock } = createDeleteEntryMock({
        rows: []
      })
      const { updateMock } = createUpdateMock([])
      const dbWrite = createEntryMutationDb({
        delete: deleteMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(deletePackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
      expect(deleteMock).not.toHaveBeenCalled()
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })
  })
})
