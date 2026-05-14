import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deletePackingListHandler from '#server/api/user/packing-lists/[id].delete'
import getPackingListHandler from '#server/api/user/packing-lists/[id].get'
import updatePackingListHandler from '#server/api/user/packing-lists/[id].patch'
import listPackingListsHandler from '#server/api/user/packing-lists/index.get'
import createPackingListHandler from '#server/api/user/packing-lists/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
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

type PackingListOrderByCallback = (table: PackingListOrderByTable, helpers: PackingListOrderByHelpers) => unknown

interface PackingListFindManyConfig {
  columns: unknown;
  orderBy: PackingListOrderByCallback;
  where: unknown;
}

interface PackingListOrderByExpression {
  column: string;
  direction: 'desc';
}

interface PackingListOrderByTable {
  createdAt: 'createdAt';
  id: 'id';
}

interface PackingListOrderByHelpers {
  desc: (column: string) => PackingListOrderByExpression;
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
  const findFirstMock = vi.fn(() => row)

  return {
    getFindFirstMock() {
      return findFirstMock
    },

    query: {
      packingLists: {
        findFirst: findFirstMock
      }
    }
  }
}

function resolvePackingListOrderBy(orderBy: PackingListOrderByCallback): unknown {
  const table: PackingListOrderByTable = {
    createdAt: 'createdAt',
    id: 'id'
  }

  const helpers: PackingListOrderByHelpers = {
    desc(column) {
      return {
        column,
        direction: 'desc'
      }
    }
  }

  return orderBy(table, helpers)
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
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }]

      const dbHttp = createListDb(rows)
      const event = createTestEvent(dbHttp)
      const result = await listPackingListsHandler(event)

      expect(result).toStrictEqual(rows)
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
        }
      })

      const orderBy = resolvePackingListOrderBy(findManyConfig.orderBy)

      expect(orderBy).toStrictEqual([{
        column: 'createdAt',
        direction: 'desc'
      }, {
        column: 'id',
        direction: 'desc'
      }])
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
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'Alpine weekend',
        updatedAt: '2026-04-03T09:00:00.000Z'
      }

      const dbHttp = createDetailDb(row)
      const event = createTestEvent(dbHttp)
      const result = await getPackingListHandler(event)

      expect(result).toStrictEqual(row)
      expect(dbHttp.getFindFirstMock()).toHaveBeenCalledWith({
        columns: {
          createdAt: true,
          id: true,
          name: true,
          updatedAt: true
        },

        where: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          userId: 'user-1'
        }
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
})
