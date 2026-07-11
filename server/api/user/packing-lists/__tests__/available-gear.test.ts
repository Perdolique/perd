import * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import listAvailableGearHandler from '#server/api/user/packing-lists/[id]/available-gear.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedQueryMock,
  getValidatedRouterParamsMock,
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    validateSessionUserMock: vi.fn<(event: unknown) => Promise<string>>()
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

vi.mock(import('#server/utils/session'), () => {
  return {
    validateSessionUser: validateSessionUserMock
  }
})

interface AvailableGearRow {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListFindFirstConfig {
  columns: unknown;
  where: unknown;
}

function expectDefinedSql(value: SQL | undefined): asserts value is SQL {
  expect(value).toBeDefined()
}

function createAvailableGearDb({
  isOwned = true,
  rows = []
}: {
  isOwned?: boolean;
  rows?: AvailableGearRow[];
} = {}) {
  const ownedList = isOwned
    ? {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      }
    : undefined
  const offsetMock = vi.fn(() => rows)
  const limitMock = vi.fn(() => {
    return {
      offset: offsetMock
    }
  })
  const orderByMock = vi.fn(() => {
    return {
      limit: limitMock
    }
  })
  const whereMock = vi.fn((_condition: SQL | undefined) => {
    return {
      orderBy: orderByMock
    }
  })
  const leftJoinMock = vi.fn(() => {
    return {
      where: whereMock
    }
  })
  const categoryJoinMock = vi.fn(() => {
    return {
      leftJoin: leftJoinMock
    }
  })
  const brandJoinMock = vi.fn(() => {
    return {
      innerJoin: categoryJoinMock
    }
  })
  const itemJoinMock = vi.fn(() => {
    return {
      innerJoin: brandJoinMock
    }
  })
  const fromMock = vi.fn(() => {
    return {
      innerJoin: itemJoinMock
    }
  })
  const findFirstMock = vi.fn((_config: PackingListFindFirstConfig) => ownedList)

  return {
    dbHttp: {
      query: {
        packingLists: {
          findFirst: findFirstMock
        }
      },

      select: vi.fn(() => {
        return {
          from: fromMock
        }
      })
    },
    findFirstMock,
    limitMock,
    offsetMock,
    orderByMock,
    whereMock
  }
}

function createAvailableGearRows(count: number): AvailableGearRow[] {
  return Array.from({ length: count }, (_unusedValue, itemIndex) => {
    return {
      brand: 'MSR',
      category: 'Stoves',
      inventoryId: `inventory-${itemIndex + 1}`,
      itemName: `Stove ${itemIndex + 1}`
    }
  })
}

describe('get /api/user/packing-lists/[id]/available-gear', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateSessionUserMock.mockResolvedValue('user-1')
    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
    getValidatedQueryMock.mockResolvedValue({
      page: 1,
      search: ''
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return the first available gear page and next page number', async () => {
    const rows = createAvailableGearRows(11)
    const { dbHttp, findFirstMock, limitMock, offsetMock, orderByMock, whereMock } = createAvailableGearDb({ rows })
    const event = createTestEvent(dbHttp)

    const result = await listAvailableGearHandler(event)

    expect(result).toStrictEqual({
      items: rows.slice(0, 10),
      nextPage: 2
    })
    expect(findFirstMock).toHaveBeenCalledWith({
      columns: {
        id: true
      },

      where: {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        userId: 'user-1'
      }
    })
    expect(whereMock).toHaveBeenCalledTimes(1)
    expect(orderByMock).toHaveBeenCalledTimes(1)
    expect(limitMock).toHaveBeenCalledWith(11)
    expect(offsetMock).toHaveBeenCalledWith(0)
  })

  it('should escape a searched later page without another page marker', async () => {
    const rows = createAvailableGearRows(2)
    const { dbHttp, offsetMock, orderByMock, whereMock } = createAvailableGearDb({ rows })
    const event = createTestEvent(dbHttp)
    const search = String.raw`MSR\%_`

    getValidatedQueryMock.mockResolvedValue({
      page: 3,
      search
    })

    const result = await listAvailableGearHandler(event)

    expect(result).toStrictEqual({
      items: rows,
      nextPage: null
    })
    expect(orderByMock).toHaveBeenCalledTimes(1)
    expect(offsetMock).toHaveBeenCalledWith(20)

    const whereCondition = whereMock.mock.calls[0]?.[0]

    expectDefinedSql(whereCondition)

    const dialect = new PgDialect()
    const whereQuery = dialect.sqlToQuery(whereCondition)
    const escapedContainsPattern = String.raw`%MSR\\\%\_%`

    expect(whereQuery.params).toContain(escapedContainsPattern)
  })

  it('should return 404 when the packing list is missing or unowned', async () => {
    const { dbHttp } = createAvailableGearDb({
      isOwned: false
    })
    const event = createTestEvent(dbHttp)

    await expect(listAvailableGearHandler(event)).rejects.toMatchObject({
      statusCode: 404
    })
  })

  it('should return 400 before querying when query validation fails', async () => {
    const queryError = h3.createError({ status: 400 })
    const { dbHttp, findFirstMock } = createAvailableGearDb()
    const event = createTestEvent(dbHttp)

    getValidatedQueryMock.mockRejectedValue(queryError)

    await expect(listAvailableGearHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
    expect(findFirstMock).not.toHaveBeenCalled()
    expect(dbHttp.select).not.toHaveBeenCalled()
  })

  it('should return 401 before querying when the user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const { dbHttp, findFirstMock } = createAvailableGearDb()
    const event = createTestEvent(dbHttp)

    validateSessionUserMock.mockRejectedValue(authError)

    await expect(listAvailableGearHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
    expect(findFirstMock).not.toHaveBeenCalled()
    expect(dbHttp.select).not.toHaveBeenCalled()
  })
})
