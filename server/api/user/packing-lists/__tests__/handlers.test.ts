import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import deletePackingListHandler from '#server/api/user/packing-lists/[id].delete'
import deletePackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/[entry-id].delete'
import updatePackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/[entry-id].patch'
import createPackingListEntryHandler from '#server/api/user/packing-lists/[id]/entries/index.post'
import getPackingListHandler from '#server/api/user/packing-lists/[id].get'
import updatePackingListHandler from '#server/api/user/packing-lists/[id].patch'
import listPackingListsHandler from '#server/api/user/packing-lists/index.get'
import createPackingListHandler from '#server/api/user/packing-lists/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const savedGearCases = [{
  source: 'catalog',

  row: {
    customName: null,
    brand: 'MSR',
    category: 'Stoves',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    itemName: 'PocketRocket Deluxe'
  },

  inventory: {
    source: 'catalog',
    brand: 'MSR',
    category: 'Stoves',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    itemName: 'PocketRocket Deluxe'
  }
}, {
  source: 'custom',

  row: {
    customName: 'My DIY Stove',
    brand: null,
    category: null,
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    itemName: null
  },

  inventory: {
    source: 'custom',
    inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    itemName: 'My DIY Stove'
  }
}] as const

const {
  createWebSocketClientMock,
  getValidatedRouteParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(event: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),

    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>(),
    readValidatedBodyMock: vi.fn<typeof nuxtServer.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof nuxtServer.setResponseStatus>(),
    validateSessionUserMock: vi.fn<(event: unknown) => Promise<string>>()
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

vi.mock(import('#server/utils/session'), () => {
  return {
    validateSessionUser: validateSessionUserMock
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial config mock.
vi.mock(import('#server/utils/config'), () => {
  return {
    createRuntimeWebSocketClient: createWebSocketClientMock
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
      limit: limitMock,

      for: vi.fn(() => {
        const rows = limitMock()

        return rows.map((row: unknown) => {
          if (typeof row !== 'object' || row === null) {
            throw new Error('Expected a list row')
          }

          const id: unknown = Reflect.get(row, 'id')

          return {
            id,
            updatedAt: new Date('2026-04-03T09:00:00.000Z')
          }
        })
      })
    }
  })

  const chain = {
    leftJoin: vi.fn(() => chain),
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
  const { selectMock } = createSelectMock([{ rows: updatedRow === undefined ? [] : [updatedRow] }])
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

  const dbWrite = createEntryMutationDb({
    select: selectMock,
    update: vi.fn(() => { return { set: updateSetMock } })
  })

  createWebSocketClientMock.mockReturnValue(dbWrite)

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

    getValidatedRouteParamsMock.mockResolvedValue({
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
    it('should return empty, unpacked, partially packed, and fully packed summaries for the current user', async () => {
      const rows = [{
        createdAt: '2026-04-03T09:00:00.000Z',
        entries: [],
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Empty trail',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }, {
        createdAt: '2026-04-03T09:01:00.000Z',

        entries: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
          isPacked: false
        }],

        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
        name: 'Unpacked trail',
        updatedAt: '2026-04-03T09:01:00.000Z'
      }, {
        createdAt: '2026-04-03T09:02:00.000Z',

        entries: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
          isPacked: true
        }, {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3',
          isPacked: false
        }],

        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
        name: 'Mixed trail',
        updatedAt: '2026-04-03T09:02:00.000Z'
      }, {
        createdAt: '2026-04-03T09:03:00.000Z',

        entries: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e4',
          isPacked: true
        }, {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e5',
          isPacked: true
        }],

        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477db',
        name: 'Ready trail',
        updatedAt: '2026-04-03T09:03:00.000Z'
      }]

      const expectedRows = [{
        createdAt: '2026-04-03T09:00:00.000Z',
        entryCount: 0,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Empty trail',
        packedCount: 0,
        updatedAt: '2026-04-03T09:00:00.000Z'
      }, {
        createdAt: '2026-04-03T09:01:00.000Z',
        entryCount: 1,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
        name: 'Unpacked trail',
        packedCount: 0,
        updatedAt: '2026-04-03T09:01:00.000Z'
      }, {
        createdAt: '2026-04-03T09:02:00.000Z',
        entryCount: 2,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
        name: 'Mixed trail',
        packedCount: 1,
        updatedAt: '2026-04-03T09:02:00.000Z'
      }, {
        createdAt: '2026-04-03T09:03:00.000Z',
        entryCount: 2,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477db',
        name: 'Ready trail',
        packedCount: 2,
        updatedAt: '2026-04-03T09:03:00.000Z'
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
              id: true,
              isPacked: true
            }
          }
        }
      })

      expect(findManyConfig.orderBy).toStrictEqual({
        createdAt: 'desc',
        id: 'desc'
      })
    })

    it('should return 401 when the user is unauthenticated', async () => {
      const authError = nuxtServer.createError({ status: 401 })
      const event = createTestEvent(createListDb([]))

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(listPackingListsHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('get /api/user/packing-lists/[id]', () => {
    it('should return an owned packing list', async () => {
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
            customName: null,
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
        }, {
          createdAt: '2026-04-03T09:03:00.000Z',
          customName: null,
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3',
          isPacked: false,
          updatedAt: '2026-04-03T09:03:00.000Z',

          userEquipment: {
            customName: 'Renamed private stove',
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
            item: null
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
            source: 'catalog',
            brand: 'MSR',
            category: 'Stoves',
            inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
            itemName: 'PocketRocket Deluxe'
          },

          isPacked: true,
          source: 'inventory',
          updatedAt: '2026-04-03T09:02:00.000Z'
        }, {
          createdAt: '2026-04-03T09:03:00.000Z',
          customName: null,
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3',
          isPacked: false,
          updatedAt: '2026-04-03T09:03:00.000Z',
          source: 'inventory',

          inventory: {
            source: 'custom',
            inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
            itemName: 'Renamed private stove'
          }
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
                  customName: true,
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

    it('should return 404 when the packing list is missing or unowned', async () => {
      const dbHttp = createDetailDb()
      const event = createTestEvent(dbHttp)

      await expect(getPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 401 when the user is unauthenticated', async () => {
      const authError = nuxtServer.createError({ status: 401 })
      const dbHttp = createDetailDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(getPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('post /api/user/packing-lists', () => {
    it('should create a packing list for the current user', async () => {
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

    it('should return 400 when body validation fails', async () => {
      const bodyError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    it('should return 401 when the user is unauthenticated', async () => {
      const authError = nuxtServer.createError({ status: 401 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(createPackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('patch /api/user/packing-lists/[id]', () => {
    it('should rename an owned packing list', async () => {
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
        name: 'Storm kit',
        updatedAt: expect.any(Date) as unknown
      })

      expect(updateWhereMock).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when the packing list is missing or unowned', async () => {
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 400 when route params validation fails', async () => {
      const routeError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouteParamsMock.mockRejectedValue(routeError)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    it('should return 401 when the user is unauthenticated', async () => {
      const authError = nuxtServer.createError({ status: 401 })
      const { dbHttp } = createUpdateDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(updatePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('delete /api/user/packing-lists/[id]', () => {
    it('should delete an owned packing list', async () => {
      const { dbHttp, deleteWhereMock } = createDeleteDb({
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      const event = createTestEvent(dbHttp)

      await expect(deletePackingListHandler(event)).resolves.toBeUndefined()
      expect(deleteWhereMock).toHaveBeenCalledTimes(1)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    })

    it('should return 404 when the packing list is missing or unowned', async () => {
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      await expect(deletePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 401 when the user is unauthenticated', async () => {
      const authError = nuxtServer.createError({ status: 401 })
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(deletePackingListHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('post /api/user/packing-lists/[id]/entries', () => {
    it('should create a custom entry and touch the parent packing list', async () => {
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
        createdAt: expect.any(Date) as unknown,
        updatedAt: expect.any(Date) as unknown,
        customName: 'Rain jacket',
        packingListId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userEquipmentId: undefined
      })

      expect(selectMock).toHaveBeenCalledTimes(1)
      expect(setMocks[0]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it.each(savedGearCases)('should create a my gear entry and touch the parent packing list ($source)', async ({ row, inventory }) => {
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
        rows: [row]
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
          inventory,
          source: 'inventory'
        },

        packingListUpdatedAt: '2026-04-03T09:02:00.000Z'
      })

      expect(valuesMock).toHaveBeenCalledWith({
        createdAt: expect.any(Date) as unknown,
        updatedAt: expect.any(Date) as unknown,
        customName: undefined,
        packingListId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userEquipmentId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })

      expect(selectMock).toHaveBeenCalledTimes(2)
      expect(setMocks[0]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when the my gear row is missing or unowned', async () => {
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

    it.each([{
      code: '23505',
      status: 409
    }, {
      code: '23503',
      status: 404
    }])('should return $status for a wrapped insert conflict ($code)', async ({ code, status }) => {
      readValidatedBodyMock.mockResolvedValue({
        inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }]
      }, {
        rows: [{
          customName: null,
          brand: 'MSR',
          category: 'Stoves',
          inventoryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
          itemName: 'PocketRocket Deluxe'
        }]
      }])

      const constraintError = new Error('Database constraint')
      const constraintCause = Object.assign(constraintError, { code })
      const queryError = new Error('Failed query with private SQL details', { cause: constraintCause })

      const { insertMock } = createInsertMock({
        error: queryError,
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
        statusCode: status
      })

      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should hide an unexpected insert failure and preserve its raw telemetry', async () => {
      const connectionError = new Error('Private connection detail')
      const technicalError = new Error('Private database failure', { cause: connectionError })

      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {
        // Capture the expected failure for the telemetry assertion below.
      })

      readValidatedBodyMock.mockResolvedValue({ customName: 'Tent' })

      const { selectMock } = createSelectMock([{
        rows: [{ id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7' }]
      }])

      const { insertMock } = createInsertMock({
        error: technicalError,
        rows: []
      })

      const { updateMock } = createUpdateMock([])

      const dbWrite = createEntryMutationDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      const event = createTestEvent({})

      createWebSocketClientMock.mockReturnValue(dbWrite)

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to create packing list entry'
      })

      expect(errorLog).toHaveBeenCalledWith('Failed to create packing list entry', technicalError)
      expect(updateMock).not.toHaveBeenCalled()
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when the parent packing list is missing or unowned', async () => {
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

    it('should return 400 when create body validation fails before opening a write client', async () => {
      const bodyError = nuxtServer.createError({ status: 400 })
      const event = createTestEvent({})

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createPackingListEntryHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })
  })

  describe('patch /api/user/packing-lists/[id]/entries/[entryId]', () => {
    it('should toggle a custom entry and touch the parent packing list', async () => {
      const updatedEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: 'Rain jacket',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        isPacked: true,
        updatedAt: '2026-04-03T09:03:00.000Z',
        userEquipmentId: null
      }

      getValidatedRouteParamsMock.mockResolvedValue({
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
        updatedAt: expect.any(Date) as unknown,
        isPacked: true
      })

      expect(setMocks[1]).toHaveBeenCalledTimes(1)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it.each(savedGearCases)('should toggle an inventory entry and keep its inventory metadata ($source)', async ({ row, inventory }) => {
      const updatedEntry = {
        createdAt: '2026-04-03T09:01:00.000Z',
        customName: null,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
        isPacked: true,
        updatedAt: '2026-04-03T09:03:00.000Z',
        userEquipmentId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
      }

      getValidatedRouteParamsMock.mockResolvedValue({
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
        rows: [row]
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
          inventory,
          isPacked: true,
          source: 'inventory',
          updatedAt: '2026-04-03T09:03:00.000Z'
        },

        packingListUpdatedAt: '2026-04-03T09:04:00.000Z'
      })

      expect(setMocks[0]).toHaveBeenCalledWith({
        updatedAt: expect.any(Date) as unknown,
        isPacked: true
      })

      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when the entry is missing from the owned packing list', async () => {
      getValidatedRouteParamsMock.mockResolvedValue({
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

    it('should keep unexpected update failures in telemetry and return a safe error', async () => {
      const technicalError = new Error('Database connection refused')

      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {
        // Expected failure diagnostics are asserted below.
      })

      getValidatedRouteParamsMock.mockResolvedValue({
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
        error: technicalError,
        rows: []
      }])

      const dbWrite = createEntryMutationDb({
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(updatePackingListEntryHandler(event)).rejects.toMatchObject({
        message: 'Failed to update packing list entry',
        statusCode: 500
      })

      expect(errorLog).toHaveBeenCalledWith('Failed to update packing list entry', technicalError)
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should hide an H3 server error when touching the parent packing list fails', async () => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {
        // Expected failure diagnostics are asserted below.
      })

      getValidatedRouteParamsMock.mockResolvedValue({
        entryId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      readValidatedBodyMock.mockResolvedValue({ isPacked: true })

      const { selectMock } = createSelectMock([{
        rows: [{ id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7' }]
      }])

      const { updateMock } = createUpdateMock([{
        rows: [{
          createdAt: '2026-04-03T09:01:00.000Z',
          customName: 'Rain jacket',
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
          isPacked: true,
          updatedAt: '2026-04-03T09:03:00.000Z',
          userEquipmentId: null
        }]
      }, {
        rows: []
      }])

      const dbWrite = createEntryMutationDb({
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(updatePackingListEntryHandler(event)).rejects.toMatchObject({
        message: 'Failed to update packing list entry',
        statusCode: 500
      })

      expect(errorLog).toHaveBeenCalledWith('Failed to update packing list entry', expect.objectContaining({
        message: 'Failed to touch packing list',
        statusCode: 500
      }))

      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })
  })

  describe('delete /api/user/packing-lists/[id]/entries/[entryId]', () => {
    it('should delete a custom entry and touch the parent packing list', async () => {
      getValidatedRouteParamsMock.mockResolvedValue({
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

    it('should return 404 when the parent packing list is missing or unowned', async () => {
      getValidatedRouteParamsMock.mockResolvedValue({
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
