import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import deleteInventoryHandler from '#server/api/user/equipment/[id].delete'
import listInventoryHandler from '#server/api/user/equipment/index.get'
import createInventoryHandler from '#server/api/user/equipment/index.post'
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

function createListDb(rows: unknown[]) {
  return {
    query: {
      userEquipment: {
        findMany: vi.fn(() => rows)
      }
    }
  }
}

function createCreateDb({
  approvedItem,
  createdRow,
  duplicateRow,
  insertError,
  inventoryRow
}: {
  approvedItem?: {
    id: string;
  };
  createdRow?: {
    id: string;
  };
  duplicateRow?: {
    id: string;
  };
  insertError?: Error;
  inventoryRow?: unknown;
} = {}) {
  const insertReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    return createdRow === undefined ? [] : [createdRow]
  })

  const insertValuesMock = vi.fn(() => {
    return {
      returning: insertReturningMock
    }
  })

  return {
    insertValuesMock,

    dbHttp: {
      insert: vi.fn(() => {
        return {
          values: insertValuesMock
        }
      }),

      query: {
        equipmentItems: {
          findFirst: vi.fn(() => approvedItem)
        },

        userEquipment: {
          findFirst: vi.fn()
            .mockImplementationOnce(() => duplicateRow)
            .mockImplementationOnce(() => inventoryRow)
        }
      }
    }
  }
}

function createDeleteDb(deletedRow?: { id: string }) {
  const deleteReturningMock = vi.fn(() => deletedRow === undefined ? [] : [deletedRow])
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

  return {
    dbHttp: {
      delete: deleteMock
    },
    deleteWhereMock
  }
}

describe('user equipment handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateSessionUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    readValidatedBodyMock.mockResolvedValue({
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/user/equipment', () => {
    test('should return the current user inventory in stable reverse chronological order', async () => {
      const event = createTestEvent(createListDb([{
        createdAt: '2026-04-01T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f1',
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
      }, {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d3',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f3',
          name: 'NeoAir XLite NXT',

          brand: {
            name: 'Therm-a-Rest',
            slug: 'therm-a-rest'
          },

          category: {
            name: 'Sleeping Pads',
            slug: 'sleeping-pads'
          }
        }
      }, {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f2',
          name: 'WhisperLite Universal',

          brand: {
            name: 'MSR',
            slug: 'msr'
          },

          category: {
            name: 'Stoves',
            slug: 'stoves'
          }
        }
      }]))

      const result = await listInventoryHandler(event)

      expect(result).toStrictEqual([{
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d3',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f3',
          name: 'NeoAir XLite NXT',

          brand: {
            name: 'Therm-a-Rest',
            slug: 'therm-a-rest'
          },

          category: {
            name: 'Sleeping Pads',
            slug: 'sleeping-pads'
          }
        }
      }, {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f2',
          name: 'WhisperLite Universal',

          brand: {
            name: 'MSR',
            slug: 'msr'
          },

          category: {
            name: 'Stoves',
            slug: 'stoves'
          }
        }
      }, {
        createdAt: '2026-04-01T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f1',
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
      }])
    })

    test('should return 401 when the user is unauthenticated', async () => {
      const authError = h3.createError({ status: 401 })
      const event = createTestEvent(createListDb([]))

      validateSessionUserMock.mockRejectedValue(authError)

      await expect(listInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('POST /api/user/equipment', () => {
    test('should create an inventory row for an approved item', async () => {
      const createdInventoryRow = {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
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
      }

      const { dbHttp, insertValuesMock } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        createdRow: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
        },

        inventoryRow: createdInventoryRow
      })

      const event = createTestEvent(dbHttp)
      const result = await createInventoryHandler(event)

      expect(result).toStrictEqual(createdInventoryRow)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
      expect(insertValuesMock).toHaveBeenCalledWith({
        itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userId: 'user-1'
      })
    })

    test('should return 404 when the item is not approved', async () => {
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      await expect(createInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    test('should return 409 when the item is already in inventory', async () => {
      const { dbHttp } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        duplicateRow: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'
        }
      })

      const event = createTestEvent(dbHttp)

      await expect(createInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 409
      })
    })

    test('should return 409 when the insert hits a duplicate constraint', async () => {
      const { dbHttp } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        insertError: Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505'
        })
      })

      const event = createTestEvent(dbHttp)

      await expect(createInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 409
      })
    })

    test('should return 400 when body validation fails', async () => {
      const bodyError = h3.createError({ status: 400 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('DELETE /api/user/equipment/[id]', () => {
    test('should delete an inventory row owned by the current user', async () => {
      const { dbHttp, deleteWhereMock } = createDeleteDb({
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      })

      const event = createTestEvent(dbHttp)

      await expect(deleteInventoryHandler(event)).resolves.toBeUndefined()

      expect(deleteWhereMock).toHaveBeenCalledTimes(1)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    })

    test('should return 404 when the row does not belong to the current user', async () => {
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      await expect(deleteInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    test('should return 400 when route params validation fails', async () => {
      const routeError = h3.createError({ status: 400 })
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouterParamsMock.mockRejectedValue(routeError)

      await expect(deleteInventoryHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })
})
