import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import renameMyGearHandler from '#server/api/user/gear/[id].patch'
import deleteMyGearHandler from '#server/api/user/gear/[id].delete'
import listMyGearHandler from '#server/api/user/gear/index.get'
import createMyGearHandler from '#server/api/user/gear/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedRouteParamsMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
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

function createListDb(rows: unknown[]) {
  let lastFindManyConfig: MyGearFindManyConfig | null = null

  const findManyMock = vi.fn((config: MyGearFindManyConfig) => {
    lastFindManyConfig = config

    return rows
  })

  return {
    getLastFindManyConfig() {
      if (lastFindManyConfig === null) {
        throw new Error('Expected userEquipment.findMany to be called')
      }

      return lastFindManyConfig
    },

    query: {
      userEquipment: {
        findMany: findManyMock
      }
    }
  }
}

interface MyGearFindManyConfig {
  columns: unknown;
  orderBy: MyGearOrderByConfig;
  where: unknown;
  with: unknown;
}

interface MyGearOrderByConfig {
  createdAt: 'desc';
  id: 'desc';
}

function createCreateDb({
  approvedItem,
  createdRow,
  duplicateRow,
  insertError,
  myGearRow
}: {
  approvedItem?: {
    id: string;
  };
  createdRow?: {
    id: string;
    customName?: string;
    createdAt?: string;
  };
  duplicateRow?: {
    id: string;
  };
  insertError?: Error;
  myGearRow?: unknown;
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
            .mockReturnValueOnce(duplicateRow)
            .mockReturnValueOnce(myGearRow)
        }
      }
    }
  }
}

function createDeleteDb({
  deletedRow,
  deleteError
}: {
  deletedRow?: { id: string; };
  deleteError?: Error;
} = {}) {
  const deleteReturningMock = vi.fn(() => {
    if (deleteError !== undefined) {
      throw deleteError
    }

    return deletedRow === undefined ? [] : [deletedRow]
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

  return {
    dbHttp: {
      delete: deleteMock
    },

    deleteWhereMock
  }
}

describe('user gear handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateSessionUserMock.mockResolvedValue('user-1')

    getValidatedRouteParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })

    readValidatedBodyMock.mockResolvedValue({
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get /api/user/gear', () => {
    it('should return complete current user gear rows', async () => {
      const dbHttp = createListDb([{
        customName: null,
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
        customName: null,
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
        customName: null,
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
        customName: null,
        createdAt: '2026-04-01T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d4',
        item: null
      }, {
        customName: null,
        createdAt: '2026-04-01T09:00:00.000Z',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d5',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477f5',
          name: 'Incomplete Stove',
          brand: null,

          category: {
            name: 'Stoves',
            slug: 'stoves'
          }
        }
      }])

      const event = createTestEvent(dbHttp)
      const result = await listMyGearHandler(event)

      expect(result).toStrictEqual([{
        source: 'catalog',
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
        source: 'catalog',
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
        source: 'catalog',
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

      expect(dbHttp.query.userEquipment.findMany).toHaveBeenCalledTimes(1)

      const findManyConfig = dbHttp.getLastFindManyConfig()

      expect(findManyConfig).toMatchObject({
        columns: {
          createdAt: true,
          id: true
        },

        where: {
          userId: 'user-1'
        },

        with: {
          item: {
            columns: {
              id: true,
              name: true
            },

            with: {
              brand: {
                columns: {
                  name: true,
                  slug: true
                }
              },

              category: {
                columns: {
                  name: true,
                  slug: true
                }
              }
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

      await expect(listMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })

  describe('post /api/user/gear', () => {
    it('should create a my gear row for an approved item', async () => {
      const createdMyGearRow = {
        source: 'catalog',
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

        myGearRow: createdMyGearRow
      })

      const event = createTestEvent(dbHttp)
      const result = await createMyGearHandler(event)

      expect(result).toStrictEqual(createdMyGearRow)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)

      expect(insertValuesMock).toHaveBeenCalledWith({
        itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userId: 'user-1'
      })
    })

    it('should return 404 when the item is not approved', async () => {
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      await expect(createMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 409 when the item is already in my gear', async () => {
      const { dbHttp } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        duplicateRow: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'
        }
      })

      const event = createTestEvent(dbHttp)

      await expect(createMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 409
      })
    })

    it('should return 409 when the insert hits a duplicate constraint', async () => {
      const insertError = new Error('duplicate key value violates unique constraint')

      Object.assign(insertError, { code: '23505' })

      const log = vi.spyOn(console, 'error').mockImplementation(() => {
        // Expected conflict logging.
      })

      const { dbHttp } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        insertError
      })

      const event = createTestEvent(dbHttp)

      await expect(createMyGearHandler(event)).rejects.toMatchObject({
        message: 'Item is already in my gear',
        statusCode: 409
      })

      expect(log).toHaveBeenCalledTimes(1)
      expect(log.mock.calls[0]?.[0]).toBe('Failed to create my gear row')
      expect(log.mock.calls[0]?.[1]).toBe(insertError)
      expect(log.mock.calls[0]?.[2]).toHaveProperty('details', expect.stringContaining('23505'))
    })

    it('should return 500 when a duplicate-looking insert error has no PostgreSQL code', async () => {
      const { dbHttp } = createCreateDb({
        approvedItem: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        },

        insertError: new Error('duplicate key value violates unique constraint')
      })

      const event = createTestEvent(dbHttp)

      await expect(createMyGearHandler(event)).rejects.toMatchObject({
        message: 'Failed to create my gear row',
        statusCode: 500
      })
    })

    it('should return 400 when body validation fails', async () => {
      const bodyError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createCreateDb()
      const event = createTestEvent(dbHttp)

      readValidatedBodyMock.mockRejectedValue(bodyError)

      await expect(createMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })

  describe('custom gear contracts', () => {
    it('returns custom gear without a fake catalog item', async () => {
      const row = {
        id: 'custom-id',
        createdAt: '2026-10-04T10:00:00.000Z',
        customName: 'DIY Stove',
        item: null
      }

      const dbHttp = createListDb([row])
      const event = createTestEvent(dbHttp)
      const result = await listMyGearHandler(event)

      expect(result).toStrictEqual([{
        id: row.id,
        createdAt: row.createdAt,
        customName: 'DIY Stove',
        source: 'custom'
      }])
    })

    it('creates custom gear without querying the catalog or deduplicating names', async () => {
      const createdRow = {
        id: 'custom-id',
        createdAt: '2026-10-04T10:00:00.000Z',
        customName: 'DIY Stove'
      }

      const { dbHttp, insertValuesMock } = createCreateDb({ createdRow })
      const event = createTestEvent(dbHttp)

      readValidatedBodyMock.mockResolvedValue({ customName: 'DIY Stove' })

      const result = await createMyGearHandler(event)

      expect(result).toStrictEqual({
        ...createdRow,
        source: 'custom'
      })

      expect(insertValuesMock).toHaveBeenCalledWith({
        customName: 'DIY Stove',
        userId: 'user-1'
      })

      expect(dbHttp.query.equipmentItems.findFirst).not.toHaveBeenCalled()
      expect(dbHttp.query.userEquipment.findFirst).not.toHaveBeenCalled()
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    })

    it.each(['23503', '23001'])('maps wrapped constraint %s to a removal conflict', async (code) => {
      const cause = new Error('Referenced gear')

      Object.assign(cause, { code })

      const deleteError = new Error('Query failed', { cause })

      const log = vi.spyOn(console, 'error').mockImplementation(() => {
        // Expected conflict logging.
      })

      const { dbHttp } = createDeleteDb({ deleteError })
      const event = createTestEvent(dbHttp)

      await expect(deleteMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 409,
        message: 'My gear item is still used in a list'
      })

      expect(log).toHaveBeenCalledTimes(1)
      expect(log.mock.calls[0]?.[0]).toBe('Failed to delete my gear row')
      expect(log.mock.calls[0]?.[1]).toBe(deleteError)
      expect(log.mock.calls[0]?.[2]).toHaveProperty('details', expect.stringContaining(code))
    })

    it.each(['create', 'rename', 'delete', 'load'] as const)('keeps unexpected %s errors in logs, not public responses', async (action) => {
      const cause = new Error('Raw database failure')
      const failure = new Error('Private SQL connection details', { cause })
      const expectedMessage = `Failed to ${action} my gear row`

      const log = vi.spyOn(console, 'error').mockImplementation(() => {
        // Expected failure logging.
      })

      const fail = vi.fn(() => { throw failure })

      const event = createTestEvent({
        insert: fail,
        update: fail,
        delete: fail,
        query: { userEquipment: { findMany: fail } }
      })

      const handlers = {
        create: createMyGearHandler,
        rename: renameMyGearHandler,
        delete: deleteMyGearHandler,
        load: listMyGearHandler
      }

      readValidatedBodyMock.mockResolvedValue({ customName: 'DIY Stove' })

      await expect(handlers[action](event)).rejects.toMatchObject({
        statusCode: 500,
        message: expectedMessage
      })

      expect(log).toHaveBeenCalledTimes(1)
      expect(log.mock.calls[0]?.[0]).toBe(expectedMessage)
      expect(log.mock.calls[0]?.[1]).toBe(failure)
      expect(log.mock.calls[0]?.[2]).toHaveProperty('details', expect.stringContaining('Raw database failure'))
    })
  })

  describe('delete /api/user/gear/[id]', () => {
    it('should delete a my gear row owned by the current user', async () => {
      const { dbHttp, deleteWhereMock } = createDeleteDb({
        deletedRow: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })

      const event = createTestEvent(dbHttp)

      await expect(deleteMyGearHandler(event)).resolves.toBeUndefined()
      expect(deleteWhereMock).toHaveBeenCalledTimes(1)
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    })

    it('should return 404 when the row does not belong to the current user', async () => {
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      await expect(deleteMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 404
      })
    })

    it('should return 409 when the my gear row is still used in a list', async () => {
      const { dbHttp } = createDeleteDb({
        deleteError: Object.assign(new Error('update or delete on table violates foreign key constraint'), {
          code: '23503'
        })
      })

      const event = createTestEvent(dbHttp)

      await expect(deleteMyGearHandler(event)).rejects.toMatchObject({
        message: 'My gear item is still used in a list',
        statusCode: 409
      })
    })

    it('should return 400 when route params validation fails', async () => {
      const routeError = nuxtServer.createError({ status: 400 })
      const { dbHttp } = createDeleteDb()
      const event = createTestEvent(dbHttp)

      getValidatedRouteParamsMock.mockRejectedValue(routeError)

      await expect(deleteMyGearHandler(event)).rejects.toMatchObject({
        statusCode: 400
      })
    })
  })
})
