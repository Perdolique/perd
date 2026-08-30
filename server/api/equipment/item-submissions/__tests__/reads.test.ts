import * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import detailHandler from '#server/api/equipment/item-submissions/[id].get'
import listHandler from '#server/api/equipment/item-submissions/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedQueryMock,
  getValidatedRouterParamsMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    },

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    }
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

function expectDefinedSql(value: SQL | undefined): asserts value is SQL {
  expect(value).toBeDefined()
}

interface DetailQueryConfig {
  columns: Record<string, boolean>;
}

function createListDb(items: unknown[], total: number) {
  const findManyMock = vi.fn(() => items)
  const countWhereMock = vi.fn((_condition: SQL | undefined) => [{ total }])

  const countFromMock = vi.fn(() => {
    return { where: countWhereMock }
  })

  const selectMock = vi.fn(() => {
    return { from: countFromMock }
  })

  return {
    dbHttp: {
      query: {
        equipmentItems: {
          findMany: findManyMock
        }
      },

      select: selectMock
    },

    countWhereMock,
    findManyMock
  }
}

describe('admin equipment submission reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('admin-1')

    getValidatedQueryMock.mockResolvedValue({
      limit: 20,
      page: 2
    })

    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should list only pending submissions in stable oldest-first pages with nullable authors', async () => {
    const items = [{
      brand: {
        id: 1,
        name: 'MSR'
      },

      category: {
        id: 2,
        name: 'Stoves'
      },

      createdAt: new Date('2026-08-01T12:00:00Z'),
      creator: null,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      name: 'PocketRocket Deluxe'
    }]

    const { countWhereMock, dbHttp, findManyMock } = createListDb(items, 21)
    const event = createTestEvent(dbHttp)
    const result = await listHandler(event)

    expect(validateAdminUserMock).toHaveBeenCalledWith(event)

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 20,
      offset: 20,

      orderBy: {
        createdAt: 'asc',
        id: 'asc'
      },

      where: {
        status: 'pending'
      }
    }))

    const countCondition = countWhereMock.mock.calls[0]?.[0]

    expectDefinedSql(countCondition)

    const countQuery = new PgDialect().sqlToQuery(countCondition)

    expect(countQuery.sql).toContain('"equipment_items"."status" = $1')
    expect(countQuery.params).toStrictEqual(['pending'])

    expect(result).toStrictEqual({
      items: [{
        author: null,

        brand: {
          id: 1,
          name: 'MSR'
        },

        category: {
          id: 2,
          name: 'Stoves'
        },

        createdAt: new Date('2026-08-01T12:00:00Z'),
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe'
      }],

      limit: 20,
      page: 2,
      total: 21
    })
  })

  it('should preserve decimal strings and boolean false in pending detail', async () => {
    const findFirstMock = vi.fn((_config: DetailQueryConfig) => {
      return {
        brand: {
          id: 1,
          name: 'MSR'
        },

        category: {
          id: 2,
          name: 'Stoves'
        },

        createdAt: new Date('2026-08-01T12:00:00Z'),

        creator: {
          id: 'author-1',
          name: 'Ada'
        },

        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe',

        propertyValues: [{
          propertyId: 3,
          valueBoolean: null,
          valueNumber: '83.50',
          valueText: null
        }, {
          propertyId: 4,
          valueBoolean: false,
          valueNumber: null,
          valueText: null
        }],

        rejectionReason: null,
        status: 'pending',
        updatedAt: new Date('2026-08-01T12:30:00Z')
      }
    })

    const event = createTestEvent({
      query: {
        equipmentItems: {
          findFirst: findFirstMock
        }
      }
    })

    const result = await detailHandler(event)

    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        status: 'pending'
      }
    }))

    const detailQueryConfig = findFirstMock.mock.calls[0]?.[0]

    expect(detailQueryConfig?.columns.updatedAt).toBe(true)

    expect(result.properties).toStrictEqual([
      {
        propertyId: 3,
        value: '83.50'
      },
      {
        propertyId: 4,
        value: false
      }
    ])

    expect(result.rejectionReason).toBeNull()
    expect(result.status).toBe('pending')
    expect(result.updatedAt).toStrictEqual(new Date('2026-08-01T12:30:00Z'))
  })

  it('should return 404 when detail is not pending', async () => {
    const event = createTestEvent({
      query: {
        equipmentItems: {
          findFirst: vi.fn()
        }
      }
    })

    await expect(detailHandler(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('should stop before database access when admin validation fails', async () => {
    const authError = h3.createError({ status: 403 })

    validateAdminUserMock.mockRejectedValue(authError)

    const event = createTestEvent({})

    await expect(listHandler(event)).rejects.toBe(authError)
    await expect(detailHandler(event)).rejects.toBe(authError)
  })
})
