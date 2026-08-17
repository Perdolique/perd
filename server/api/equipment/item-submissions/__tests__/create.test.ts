import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryProperties, contributions, equipmentItems, itemPropertyValues } from '#server/database/schema'
import createItemSubmissionHandler from '#server/api/equipment/item-submissions/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  createWebSocketClientMock,
  readValidatedBodyMock,
  setResponseStatusMock,
  validateRegisteredUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn(),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateRegisteredUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async readValidatedBody(...args: Parameters<typeof h3.readValidatedBody>) {
      return readValidatedBodyMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    validateRegisteredUser: validateRegisteredUserMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

interface CreateDbOptions {
  brand?: unknown;
  category?: unknown;
  contributionError?: Error;
  createdItemId?: string;
}

function createDb(options: CreateDbOptions = {}) {
  const defaultCategory = {
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

  const brand = 'brand' in options ? options.brand : {
    id: 1,
    name: 'MSR'
  }

  const category = 'category' in options ? options.category : defaultCategory
  const { contributionError } = options
  const createdItemId = options.createdItemId ?? '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
  const itemReturningMock = vi.fn(() => [{ id: createdItemId }])

  const itemValuesMock = vi.fn(() => {
    return { returning: itemReturningMock }
  })

  const propertyValuesMock = vi.fn()

  const contributionValuesMock = vi.fn(() => {
    if (contributionError !== undefined) {
      throw contributionError
    }
  })

  const insertMock = vi.fn()
  const propertyLockForMock = vi.fn(() => [])

  const propertyLockWhereMock = vi.fn(() => {
    return { for: propertyLockForMock }
  })

  const propertyLockFromMock = vi.fn(() => {
    return { where: propertyLockWhereMock }
  })

  const selectMock = vi.fn(() => {
    return { from: propertyLockFromMock }
  })

  insertMock.mockImplementation((table: unknown) => {
    if (table === equipmentItems) {
      return { values: itemValuesMock }
    }

    if (table === itemPropertyValues) {
      return { values: propertyValuesMock }
    }

    if (table === contributions) {
      return { values: contributionValuesMock }
    }

    throw new Error('Unexpected insert table')
  })

  const transaction = {
    insert: insertMock,
    select: selectMock,

    query: {
      brands: {
        findFirst: vi.fn(() => brand)
      },

      equipmentCategories: {
        findFirst: vi.fn(() => category)
      }
    }
  }

  const transactionMock = vi.fn(
    async (execute: (transactionValue: typeof transaction) => Promise<unknown>) => execute(transaction)
  )

  const endMock = vi.fn()

  const dbWrite = {
    $client: {
      end: endMock
    },

    transaction: transactionMock
  }

  return {
    contributionValuesMock,
    dbWrite,
    insertMock,
    itemValuesMock,
    propertyLockForMock,
    propertyLockFromMock,
    propertyValuesMock,
    selectMock,
    transaction
  }
}

describe('post /api/equipment/item-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateRegisteredUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      properties: []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create a pending item and contribution without creating My gear', async () => {
    const { contributionValuesMock, dbWrite, insertMock, itemValuesMock, transaction } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createTestEvent({})
    const result = await createItemSubmissionHandler(event)

    expect(result).toStrictEqual({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      status: 'pending'
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(transaction.query.brands.findFirst).toHaveBeenCalledWith({
      columns: {
        id: true,
        name: true
      },

      where: {
        id: 1
      }
    })
    expect(transaction.query.equipmentCategories.findFirst).toHaveBeenCalledWith({
      columns: {
        id: true,
        name: true
      },

      where: {
        id: 2
      },

      with: {
        properties: {
          columns: {
            allowsNegativeValues: true,
            categoryId: true,
            dataType: true,
            id: true
          },

          with: {
            enumOptions: {
              columns: {
                slug: true
              }
            }
          }
        }
      }
    })

    expect(itemValuesMock).toHaveBeenCalledWith({
      brandId: 1,
      categoryId: 2,
      createdBy: 'user-1',
      name: 'PocketRocket Deluxe',
      status: 'pending'
    })

    expect(contributionValuesMock).toHaveBeenCalledWith({
      action: 'submit_equipment_item',

      metadata: {
        brandId: 1,
        brandName: 'MSR',
        categoryId: 2,
        categoryName: 'Stoves',
        name: 'PocketRocket Deluxe',
        propertyCount: 0,
        status: 'pending'
      },

      targetId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      userId: 'user-1'
    })
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should insert normalized non-empty properties in the same transaction', async () => {
    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',

      properties: [{
        propertyId: 3,
        value: '+0083.500'
      }, {
        propertyId: 4,
        value: false
      }]
    })

    const {
      dbWrite,
      propertyLockForMock,
      propertyLockFromMock,
      propertyValuesMock,
      selectMock,
      transaction
    } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)

    await createItemSubmissionHandler(createTestEvent({}))

    expect(selectMock).toHaveBeenCalledWith({
      id: categoryProperties.id
    })
    expect(propertyLockFromMock).toHaveBeenCalledWith(categoryProperties)
    expect(propertyLockForMock).toHaveBeenCalledWith('key share')

    const propertyLockCallOrder = Math.min(...propertyLockForMock.mock.invocationCallOrder)

    const categoryReadCallOrder = Math.min(
      ...transaction.query.equipmentCategories.findFirst.mock.invocationCallOrder
    )

    expect(propertyLockCallOrder).toBeLessThan(categoryReadCallOrder)

    expect(propertyValuesMock).toHaveBeenCalledWith([{
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
  })

  it('should reject a negative property value before inserting the item', async () => {
    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',

      properties: [{
        propertyId: 3,
        value: '-83.5'
      }]
    })

    const { dbWrite, insertMock } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      message: 'Number property value must not be negative',
      statusCode: 400
    })
    expect(insertMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should require a session before opening the write client', async () => {
    const authError = h3.createError({ status: 401 })

    validateRegisteredUserMock.mockRejectedValue(authError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 401
    })
    expect(readValidatedBodyMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should reject a Guest before validating the body or opening the write client', async () => {
    const guestError = h3.createError({ status: 403 })

    validateRegisteredUserMock.mockRejectedValue(guestError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 403
    })
    expect(readValidatedBodyMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should validate the body before opening the write client', async () => {
    const bodyError = h3.createError({ status: 400 })

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 400
    })
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      brand: undefined,

      category: {
        id: 2,
        name: 'Stoves',
        properties: []
      }
    },
    {
      brand: {
        id: 1,
        name: 'MSR'
      },

      category: undefined
    }
  ])('should return 404 when a selected reference disappears', async (options) => {
    const { dbWrite } = createDb(options)

    createWebSocketClientMock.mockReturnValue(dbWrite)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 404
    })
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should log the original error, return a safe 500, and close the client', async () => {
    const databaseError = new Error('raw database failure')
    const consoleErrorMock = vi.spyOn(console, 'error')
    const { dbWrite } = createDb({ contributionError: databaseError })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      message: 'Failed to submit equipment item',
      statusCode: 500
    })
    expect(consoleErrorMock).toHaveBeenCalledWith('Failed to submit equipment item', databaseError)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })
})
