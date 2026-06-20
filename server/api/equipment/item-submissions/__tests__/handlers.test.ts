import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import moderateSubmissionHandler from '#server/api/equipment/item-submissions/[id].patch'
import listSubmissionsHandler from '#server/api/equipment/item-submissions/index.get'
import createSubmissionHandler from '#server/api/equipment/item-submissions/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface MockWriteTransaction {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: {
    end: ReturnType<typeof vi.fn>;
  };
  transaction: ReturnType<typeof vi.fn>;
}

interface SelectOperation {
  rows: unknown;
  type: 'limit' | 'where';
}

interface InsertOperation {
  result?: unknown;
  type: 'returning' | 'values';
}

const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const inventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'

const {
  createWebSocketClientMock,
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<() => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateAdminUserMock: vi.fn<() => Promise<string>>(),
    validateSessionUserMock: vi.fn<() => Promise<string>>()
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

vi.mock(import('#server/utils/session'), () => {
  return {
    validateSessionUser: validateSessionUserMock
  }
})

function createSelectMock(operations: SelectOperation[]) {
  const whereMock = vi.fn(() => {
    const operation = operations.shift()

    if (operation === undefined) {
      throw new Error('No select operation configured')
    }

    if (operation.type === 'limit') {
      return {
        limit: vi.fn(() => operation.rows)
      }
    }

    return operation.rows
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

function createJoinedSelectMock(rows: unknown) {
  const limitMock = vi.fn(() => rows)
  const whereMock = vi.fn(() => {
    return {
      limit: limitMock
    }
  })
  const secondJoinMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })
  const firstJoinMock = vi.fn(() => {
    return {
      innerJoin: secondJoinMock
    }
  })
  const fromMock = vi.fn(() => {
    return {
      innerJoin: firstJoinMock
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
      if (operation.type === 'returning') {
        return {
          returning: vi.fn(() => operation.result)
        }
      }

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

function createUpdateMock(result: unknown) {
  const returningMock = vi.fn(() => result)
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
  const updateMock = vi.fn(() => {
    return {
      set: setMock
    }
  })

  return {
    setMock,
    updateMock
  }
}

function createWriteDb(transaction: MockWriteTransaction) {
  const transactionMock = vi.fn(
    async (executeTransaction: (db: MockWriteTransaction) => Promise<unknown>) => executeTransaction(transaction)
  )
  const endMock = vi.fn(async () => {
    await Promise.resolve()
  })

  return {
    $client: {
      end: endMock
    },
    transaction: transactionMock
  }
}

function createAdminListDb(rows: unknown[]) {
  const orderByMock = vi.fn(() => rows)
  const whereMock = vi.fn(() => {
    return {
      orderBy: orderByMock
    }
  })
  const secondJoinMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })
  const firstJoinMock = vi.fn(() => {
    return {
      innerJoin: secondJoinMock
    }
  })
  const fromMock = vi.fn(() => {
    return {
      innerJoin: firstJoinMock
    }
  })
  const selectMock = vi.fn(() => {
    return {
      from: fromMock
    }
  })

  return {
    select: selectMock
  }
}

describe('item submission handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedRouterParamsMock.mockResolvedValue({
      id: itemId
    })

    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',

      properties: [{
        propertyId: 10,
        value: '83'
      }, {
        propertyId: 11,
        value: false
      }, {
        propertyId: 12,
        value: 'canister'
      }]
    })

    validateAdminUserMock.mockResolvedValue(userId)
    validateSessionUserMock.mockResolvedValue(userId)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('post /api/equipment/item-submissions', () => {
    it('should create a pending item, property rows, inventory row, and contribution', async () => {
      const { selectMock } = createSelectMock([{
        rows: [{
          id: 1,
          name: 'MSR',
          slug: 'msr'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }],
        type: 'limit'
      }, {
        rows: [],
        type: 'limit'
      }, {
        rows: [{
          dataType: 'number',
          id: 10,
          name: 'Weight',
          slug: 'weight',
          unit: 'g'
        }, {
          dataType: 'boolean',
          id: 11,
          name: 'Piezo',
          slug: 'piezo',
          unit: null
        }, {
          dataType: 'enum',
          id: 12,
          name: 'Fuel',
          slug: 'fuel',
          unit: null
        }],
        type: 'where'
      }, {
        rows: [{
          propertyId: 12,
          slug: 'canister'
        }],
        type: 'where'
      }])

      const { insertMock, valuesMocks } = createInsertMock([{
        result: [{
          createdAt: '2026-04-01T00:00:00.000Z',
          id: itemId,
          name: 'PocketRocket Deluxe',
          status: 'pending'
        }],
        type: 'returning'
      }, {
        type: 'values'
      }, {
        result: [{
          createdAt: '2026-04-01T00:00:00.000Z',
          id: inventoryId
        }],
        type: 'returning'
      }, {
        type: 'values'
      }])

      const dbWrite = createWriteDb({
        insert: insertMock,
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await createSubmissionHandler(event)

      expect(result).toStrictEqual({
        inventory: {
          createdAt: '2026-04-01T00:00:00.000Z',
          id: inventoryId,

          item: {
            id: itemId,
            name: 'PocketRocket Deluxe',

            brand: {
              name: 'MSR',
              slug: 'msr'
            },

            category: {
              name: 'Stoves',
              slug: 'stoves'
            }
          }
        },

        item: {
          createdAt: '2026-04-01T00:00:00.000Z',
          id: itemId,
          name: 'PocketRocket Deluxe',

          brand: {
            name: 'MSR',
            slug: 'msr'
          },

          category: {
            name: 'Stoves',
            slug: 'stoves'
          },

          properties: [{
            dataType: 'number',
            name: 'Weight',
            slug: 'weight',
            unit: 'g',
            value: '83'
          }, {
            dataType: 'boolean',
            name: 'Piezo',
            slug: 'piezo',
            unit: null,
            value: 'false'
          }, {
            dataType: 'enum',
            name: 'Fuel',
            slug: 'fuel',
            unit: null,
            value: 'canister'
          }],

          status: 'pending'
        }
      })

      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(valuesMocks[1]).toHaveBeenCalledWith([{
        itemId,
        propertyId: 10,
        valueBoolean: null,
        valueNumber: '83',
        valueText: null
      }, {
        itemId,
        propertyId: 11,
        valueBoolean: false,
        valueNumber: null,
        valueText: null
      }, {
        itemId,
        propertyId: 12,
        valueBoolean: null,
        valueNumber: null,
        valueText: 'canister'
      }])
      expect(valuesMocks[3]).toHaveBeenCalledWith({
        action: 'submit_equipment_item',

        metadata: {
          brandId: 1,
          categoryId: 2,
          name: 'PocketRocket Deluxe',
          propertyCount: 3,
          status: 'pending'
        },

        targetId: itemId,
        userId
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should return 401 when user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const event = createTestEvent({})

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })

      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    })

    it('should return 404 when brand is missing', async () => {
      const { selectMock } = createSelectMock([{
        rows: [],
        type: 'limit'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 409 when a non-rejected duplicate exists', async () => {
      const { selectMock } = createSelectMock([{
        rows: [{
          id: 1,
          name: 'MSR',
          slug: 'msr'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: itemId
        }],
        type: 'limit'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 409
      })
    })

    it('should return 400 when a submitted property is outside the category', async () => {
      readValidatedBodyMock.mockResolvedValue({
        brandId: 1,
        categoryId: 2,
        name: 'PocketRocket Deluxe',

        properties: [{
          propertyId: 99,
          value: '83'
        }]
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 1,
          name: 'MSR',
          slug: 'msr'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }],
        type: 'limit'
      }, {
        rows: [],
        type: 'limit'
      }, {
        rows: [],
        type: 'where'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    it('should return 400 when enum value is not a category option', async () => {
      readValidatedBodyMock.mockResolvedValue({
        brandId: 1,
        categoryId: 2,
        name: 'PocketRocket Deluxe',

        properties: [{
          propertyId: 12,
          value: 'white-gas'
        }]
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 1,
          name: 'MSR',
          slug: 'msr'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }],
        type: 'limit'
      }, {
        rows: [],
        type: 'limit'
      }, {
        rows: [{
          dataType: 'enum',
          id: 12,
          name: 'Fuel',
          slug: 'fuel',
          unit: null
        }],
        type: 'where'
      }, {
        rows: [{
          propertyId: 12,
          slug: 'canister'
        }],
        type: 'where'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })

    it('should return 400 when number value is malformed', async () => {
      readValidatedBodyMock.mockResolvedValue({
        brandId: 1,
        categoryId: 2,
        name: 'PocketRocket Deluxe',

        properties: [{
          propertyId: 10,
          value: '83g'
        }]
      })

      const { selectMock } = createSelectMock([{
        rows: [{
          id: 1,
          name: 'MSR',
          slug: 'msr'
        }],
        type: 'limit'
      }, {
        rows: [{
          id: 2,
          name: 'Stoves',
          slug: 'stoves'
        }],
        type: 'limit'
      }, {
        rows: [],
        type: 'limit'
      }, {
        rows: [{
          dataType: 'number',
          id: 10,
          name: 'Weight',
          slug: 'weight',
          unit: 'g'
        }],
        type: 'where'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(createSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('get /api/equipment/item-submissions', () => {
    it('should return pending submission summaries for admins', async () => {
      const rows = [{
        createdAt: '2026-04-01T00:00:00.000Z',
        createdBy: userId,
        id: itemId,
        name: 'PocketRocket Deluxe',
        status: 'pending',

        brand: {
          name: 'MSR',
          slug: 'msr'
        },

        category: {
          name: 'Stoves',
          slug: 'stoves'
        }
      }]
      const dbHttp = createAdminListDb(rows)
      const event = createTestEvent(dbHttp)
      const result = await listSubmissionsHandler(event)

      expect(result).toStrictEqual(rows)
      expect(validateAdminUserMock).toHaveBeenCalledWith(event)
    })

    it('should return 403 when list reader is not an admin', async () => {
      const authError = h3.createError({ status: 403 })
      const event = createTestEvent(createAdminListDb([]))

      validateAdminUserMock.mockRejectedValue(authError)

      await expect(listSubmissionsHandler(event)).rejects.toMatchObject({
        statusCode: 403
      })
    })
  })

  describe('patch /api/equipment/item-submissions/[id]', () => {
    beforeEach(() => {
      readValidatedBodyMock.mockResolvedValue({
        status: 'approved'
      })
    })

    it('should approve a pending submission and log a contribution', async () => {
      const { selectMock } = createJoinedSelectMock([{
        brandName: 'MSR',
        brandSlug: 'msr',
        categoryName: 'Stoves',
        categorySlug: 'stoves',
        createdAt: '2026-04-01T00:00:00.000Z',
        createdBy: userId,
        id: itemId,
        name: 'PocketRocket Deluxe',
        status: 'pending'
      }])
      const { updateMock, setMock } = createUpdateMock([{
        status: 'approved'
      }])
      const { insertMock, valuesMocks } = createInsertMock([{
        type: 'values'
      }])
      const dbWrite = createWriteDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await moderateSubmissionHandler(event)

      expect(result).toStrictEqual({
        createdAt: '2026-04-01T00:00:00.000Z',
        createdBy: userId,
        id: itemId,
        name: 'PocketRocket Deluxe',
        status: 'approved',

        brand: {
          name: 'MSR',
          slug: 'msr'
        },

        category: {
          name: 'Stoves',
          slug: 'stoves'
        }
      })
      expect(setMock).toHaveBeenCalledWith({
        status: 'approved'
      })
      expect(valuesMocks[0]).toHaveBeenCalledWith({
        action: 'approve_equipment_item',

        metadata: {
          previousStatus: 'pending',
          status: 'approved'
        },

        targetId: itemId,
        userId
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should reject a pending submission and log a contribution', async () => {
      readValidatedBodyMock.mockResolvedValue({
        status: 'rejected'
      })

      const { selectMock } = createJoinedSelectMock([{
        brandName: 'MSR',
        brandSlug: 'msr',
        categoryName: 'Stoves',
        categorySlug: 'stoves',
        createdAt: '2026-04-01T00:00:00.000Z',
        createdBy: userId,
        id: itemId,
        name: 'PocketRocket Deluxe',
        status: 'pending'
      }])
      const { updateMock } = createUpdateMock([{
        status: 'rejected'
      }])
      const { insertMock, valuesMocks } = createInsertMock([{
        type: 'values'
      }])
      const dbWrite = createWriteDb({
        insert: insertMock,
        select: selectMock,
        update: updateMock
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})
      const result = await moderateSubmissionHandler(event)

      expect(result.status).toBe('rejected')
      expect(valuesMocks[0]).toHaveBeenCalledWith({
        action: 'reject_equipment_item',

        metadata: {
          previousStatus: 'pending',
          status: 'rejected'
        },

        targetId: itemId,
        userId
      })
    })

    it('should return 409 when submission is not pending', async () => {
      const { selectMock } = createJoinedSelectMock([{
        brandName: 'MSR',
        brandSlug: 'msr',
        categoryName: 'Stoves',
        categorySlug: 'stoves',
        createdAt: '2026-04-01T00:00:00.000Z',
        createdBy: userId,
        id: itemId,
        name: 'PocketRocket Deluxe',
        status: 'approved'
      }])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(moderateSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 409
      })
      expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    })

    it('should return 404 when submission does not exist', async () => {
      const { selectMock } = createJoinedSelectMock([])
      const dbWrite = createWriteDb({
        insert: vi.fn(),
        select: selectMock,
        update: vi.fn()
      })

      createWebSocketClientMock.mockReturnValue(dbWrite)

      const event = createTestEvent({})

      await expect(moderateSubmissionHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })
})
