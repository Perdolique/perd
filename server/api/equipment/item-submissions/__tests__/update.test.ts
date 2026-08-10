import * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contributions,
  equipmentItems,
  itemPropertyValues
} from '#server/database/schema'
import updateHandler from '#server/api/equipment/item-submissions/[id].patch'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  createWebSocketClientMock,
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
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
    }
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return { validateAdminUser: validateAdminUserMock }
})

vi.mock(import('#server/utils/config'), () => {
  return { createWebSocketClientFromEvent: createWebSocketClientMock }
})

interface UpdateDbOptions {
  contributionError?: Error;
  item?: unknown;
}

function expectIdPredicate(
  condition: SQL | undefined,
  tableName: 'equipment_items' | 'item_property_values'
) {
  expect(condition).toBeDefined()

  if (condition === undefined) {
    throw new Error('Expected an item id predicate')
  }

  const query = new PgDialect().sqlToQuery(condition)

  expect(query.sql).toContain(`"${tableName}"."${tableName === 'equipment_items' ? 'id' : 'itemId'}" = $1`)
  expect(query.params).toStrictEqual(['0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'])
}

function createUpdateDb(options: UpdateDbOptions = {}) {
  const defaultItem = {
    createdAt: new Date('2026-08-01T12:00:00Z'),
    createdBy: 'author-1',
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
    status: 'pending',
    updatedAt: new Date('2026-08-01T12:30:00Z')
  }
  const item = 'item' in options ? options.item : defaultItem
  const itemLockForMock = vi.fn(() => item === undefined ? [] : [item])
  const itemLockLimitMock = vi.fn(() => {
    return { for: itemLockForMock }
  })
  const itemLockWhereMock = vi.fn(() => {
    return { limit: itemLockLimitMock }
  })
  const propertyLockForMock = vi.fn(() => [{ id: 3 }, { id: 4 }])
  const propertyLockWhereMock = vi.fn(() => {
    return { for: propertyLockForMock }
  })
  const selectMock = vi.fn((selection: Record<string, unknown>) => {
    if ('status' in selection) {
      return {
        from: vi.fn(() => {
          return { where: itemLockWhereMock }
        })
      }
    }

    return {
      from: vi.fn(() => {
        return { where: propertyLockWhereMock }
      })
    }
  })
  const updatedAt = new Date('2026-08-01T12:31:00Z')
  const updateReturningMock = vi.fn(() => [{ updatedAt }])
  const updateWhereMock = vi.fn((_condition: SQL | undefined) => {
    return { returning: updateReturningMock }
  })
  const updateSetMock = vi.fn(() => {
    return { where: updateWhereMock }
  })
  const updateMock = vi.fn((table: unknown) => {
    expect(table).toBe(equipmentItems)

    return { set: updateSetMock }
  })
  const deleteWhereMock = vi.fn((_condition: SQL | undefined) => [])
  const deleteMock = vi.fn((table: unknown) => {
    expect(table).toBe(itemPropertyValues)

    return { where: deleteWhereMock }
  })
  const propertyValuesMock = vi.fn()
  const contributionValuesMock = vi.fn(() => {
    if (options.contributionError !== undefined) {
      throw options.contributionError
    }
  })
  const insertMock = vi.fn((table: unknown) => {
    if (table === itemPropertyValues) {
      return { values: propertyValuesMock }
    }

    if (table === contributions) {
      return { values: contributionValuesMock }
    }

    throw new Error('Unexpected insert table')
  })
  const transaction = {
    delete: deleteMock,
    insert: insertMock,
    select: selectMock,
    update: updateMock,

    query: {
      brands: {
        findFirst: vi.fn(() => {
          return { id: 1, name: 'MSR' }
        })
      },
      equipmentCategories: {
        findFirst: vi.fn(() => {
          return {
            id: 2,
            name: 'Stoves',
            properties: [{
              allowsNegativeValues: false,
              categoryId: 2,
              dataType: 'number',
              enumOptions: [],
              id: 3
            }, {
              allowsNegativeValues: false,
              categoryId: 2,
              dataType: 'boolean',
              enumOptions: [],
              id: 4
            }]
          }
        })
      },
      users: {
        findFirst: vi.fn(() => {
          return { id: 'author-1', name: null }
        })
      }
    }
  }
  /* oxlint-disable promise/prefer-await-to-callbacks -- The mock executes Drizzle's transaction callback. */
  const transactionMock = vi.fn(
    async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)
  )
  /* oxlint-enable promise/prefer-await-to-callbacks */
  const endMock = vi.fn()
  const dbWrite = {
    $client: { end: endMock },
    transaction: transactionMock
  }

  return {
    contributionValuesMock,
    dbWrite,
    deleteWhereMock,
    endMock,
    itemLockForMock,
    propertyLockForMock,
    propertyValuesMock,
    selectMock,
    transactionMock,
    updateReturningMock,
    updateWhereMock,
    updateSetMock
  }
}

describe('patch /api/equipment/item-submissions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('admin-1')
    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe',
      properties: [{ propertyId: 3, value: '83.50' }, { propertyId: 4, value: false }]
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should lock, fully replace EAV values, and log the update atomically', async () => {
    const db = createUpdateDb()

    createWebSocketClientMock.mockReturnValue(db.dbWrite)

    const event = createTestEvent({})
    const result = await updateHandler(event)

    expect(db.selectMock).toHaveBeenCalledWith(expect.objectContaining({
      updatedAt: equipmentItems.updatedAt
    }))
    expect(db.itemLockForMock).toHaveBeenCalledWith('update')
    expect(db.propertyLockForMock).toHaveBeenCalledWith('key share')
    const itemLockOrder = Math.max(...db.itemLockForMock.mock.invocationCallOrder)
    const propertyLockOrder = Math.min(...db.propertyLockForMock.mock.invocationCallOrder)

    expect(itemLockOrder).toBeLessThan(propertyLockOrder)
    expect(db.updateSetMock).toHaveBeenCalledWith({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      rejectionReason: null,
      status: 'pending'
    })
    expectIdPredicate(db.updateWhereMock.mock.calls[0]?.[0], 'equipment_items')
    expect(db.updateReturningMock).toHaveBeenCalledWith({
      updatedAt: equipmentItems.updatedAt
    })
    expect(db.deleteWhereMock).toHaveBeenCalledTimes(1)
    expectIdPredicate(db.deleteWhereMock.mock.calls[0]?.[0], 'item_property_values')
    expect(db.propertyValuesMock).toHaveBeenCalledWith([{
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      propertyId: 3,
      valueBoolean: null,
      valueNumber: '83.5',
      valueText: null
    }, {
      itemId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      propertyId: 4,
      valueBoolean: false,
      valueNumber: null,
      valueText: null
    }])
    expect(db.contributionValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update_equipment_item_submission',
      targetId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      userId: 'admin-1'
    }))
    expect(result.properties).toStrictEqual([
      { propertyId: 3, value: '83.5' },
      { propertyId: 4, value: false }
    ])
    expect(result.rejectionReason).toBeNull()
    expect(result.status).toBe('pending')
    expect(result.updatedAt).toStrictEqual(new Date('2026-08-01T12:31:00Z'))
    expect(db.endMock).toHaveBeenCalledTimes(1)
  })

  it.each([{
    action: 'publish_item_submission',
    body: {
      brandId: 1,
      categoryId: 2,
      decision: 'publish',
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe',
      properties: [{ propertyId: 3, value: '83.50' }]
    },
    rejectionReason: null,
    status: 'approved'
  }, {
    action: 'reject_item_submission',
    body: {
      brandId: 1,
      categoryId: 2,
      decision: 'reject',
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe',
      properties: [{ propertyId: 3, value: '83.50' }],
      rejectionReason: 'Duplicate catalog item'
    },
    rejectionReason: 'Duplicate catalog item',
    status: 'rejected'
  }] as const)(
    'should apply one decision with one $action contribution',
    async ({ action, body, rejectionReason, status }) => {
      const db = createUpdateDb()

      createWebSocketClientMock.mockReturnValue(db.dbWrite)
      readValidatedBodyMock.mockResolvedValue(body)

      const result = await updateHandler(createTestEvent({}))

      expect(db.updateSetMock).toHaveBeenCalledWith({
        brandId: 1,
        categoryId: 2,
        name: 'PocketRocket Deluxe',
        rejectionReason,
        status
      })
      expect(db.contributionValuesMock).toHaveBeenCalledTimes(1)
      expect(db.contributionValuesMock).toHaveBeenCalledWith(expect.objectContaining({ action }))
      expect(result.rejectionReason).toBe(rejectionReason)
      expect(result.status).toBe(status)
    }
  )

  it('should delete all EAV values without inserting replacements when properties are empty', async () => {
    const db = createUpdateDb()

    createWebSocketClientMock.mockReturnValue(db.dbWrite)
    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe',
      properties: []
    })

    const result = await updateHandler(createTestEvent({}))

    expect(db.deleteWhereMock).toHaveBeenCalledTimes(1)
    expectIdPredicate(db.deleteWhereMock.mock.calls[0]?.[0], 'item_property_values')
    expect(db.propertyValuesMock).not.toHaveBeenCalled()
    expect(result.properties).toStrictEqual([])
  })

  it('should return 404 for a missing submission before replacement', async () => {
    const db = createUpdateDb({ item: undefined })

    createWebSocketClientMock.mockReturnValue(db.dbWrite)

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({ statusCode: 404 })
    expect(db.propertyValuesMock).not.toHaveBeenCalled()
    expect(db.endMock).toHaveBeenCalledTimes(1)
  })

  it('should return 409 for a non-pending submission before replacement', async () => {
    const db = createUpdateDb({ item: { id: 'item-1', status: 'approved' } })

    createWebSocketClientMock.mockReturnValue(db.dbWrite)

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({ statusCode: 409 })
    expect(db.propertyValuesMock).not.toHaveBeenCalled()
    expect(db.endMock).toHaveBeenCalledTimes(1)
  })

  it('should return 409 for a stale revision before replacement', async () => {
    const db = createUpdateDb({
      item: {
        createdAt: new Date('2026-08-01T12:00:00Z'),
        createdBy: 'author-1',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        status: 'pending',
        updatedAt: new Date('2026-08-01T12:31:00Z')
      }
    })

    createWebSocketClientMock.mockReturnValue(db.dbWrite)

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({ statusCode: 409 })
    expect(db.propertyLockForMock).not.toHaveBeenCalled()
    expect(db.updateWhereMock).not.toHaveBeenCalled()
    expect(db.deleteWhereMock).not.toHaveBeenCalled()
  })

  it('should return a safe 500 and close the client when the transaction rolls back', async () => {
    const technicalError = new Error('database credentials and raw failure')
    const db = createUpdateDb({ contributionError: technicalError })
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation((...messages) => {
      void messages
    })

    createWebSocketClientMock.mockReturnValue(db.dbWrite)

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({
      message: 'Failed to update equipment item submission',
      statusCode: 500
    })
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to update equipment item submission',
      technicalError
    )
    expect(db.transactionMock).toHaveBeenCalledTimes(1)
    expect(db.endMock).toHaveBeenCalledTimes(1)
  })

  it('should validate admin access before body parsing and database creation', async () => {
    const authError = h3.createError({ status: 403 })

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(updateHandler(createTestEvent({}))).rejects.toBe(authError)
    expect(readValidatedBodyMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })
})
