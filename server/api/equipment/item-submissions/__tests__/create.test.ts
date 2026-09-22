import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryProperties, contributions, equipmentItems, itemPropertyValues } from '#server/database/schema'
import createItemSubmissionHandler from '#server/api/equipment/item-submissions/index.post'
import type { RegisteredUserAccess } from '#server/utils/user'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  createWebSocketClientMock,
  getItemSubmissionRateLimiterBindingMock,
  itemSubmissionLimitMock,
  readValidatedBodyMock,
  setResponseHeaderMock,
  setResponseStatusMock,
  validateRegisteredUserAccessMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn(),
    getItemSubmissionRateLimiterBindingMock: vi.fn(),
    itemSubmissionLimitMock: vi.fn<Env['ITEM_SUBMISSION_RATE_LIMITER']['limit']>(),
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseHeaderMock: vi.fn<typeof h3.setResponseHeader>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),

    validateRegisteredUserAccessMock: vi.fn<
      (event: h3.H3Event) => Promise<RegisteredUserAccess>
    >()
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

    setResponseHeader(...args: Parameters<typeof h3.setResponseHeader>) {
      setResponseHeaderMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    validateRegisteredUserAccess: validateRegisteredUserAccessMock
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return {
    getItemSubmissionRateLimiterBinding: getItemSubmissionRateLimiterBindingMock
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

    validateRegisteredUserAccessMock.mockResolvedValue({
      isAdmin: false,
      userId: 'user-1'
    })

    itemSubmissionLimitMock.mockResolvedValue({ success: true })
    getItemSubmissionRateLimiterBindingMock.mockReturnValue({ limit: itemSubmissionLimitMock })

    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      sourceUrl: 'https://example.com/product',
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
      sourceUrl: 'https://example.com/product',
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

  it('should apply the user limiter after auth and body validation but before the write client', async () => {
    const { dbWrite } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)
    await createItemSubmissionHandler(createTestEvent({}))
    expect(itemSubmissionLimitMock).toHaveBeenCalledTimes(1)

    expect(itemSubmissionLimitMock).toHaveBeenCalledWith({
      key: 'submit_equipment_item:user:user-1'
    })

    const authOrder = Math.min(...validateRegisteredUserAccessMock.mock.invocationCallOrder)
    const bodyOrder = Math.min(...readValidatedBodyMock.mock.invocationCallOrder)
    const bindingOrder = Math.min(...getItemSubmissionRateLimiterBindingMock.mock.invocationCallOrder)
    const limiterOrder = Math.min(...itemSubmissionLimitMock.mock.invocationCallOrder)
    const writeClientOrder = Math.min(...createWebSocketClientMock.mock.invocationCallOrder)

    expect(authOrder).toBeLessThan(bodyOrder)
    expect(bodyOrder).toBeLessThan(bindingOrder)
    expect(bindingOrder).toBeLessThan(limiterOrder)
    expect(limiterOrder).toBeLessThan(writeClientOrder)
  })

  it('should bypass the limiter entirely for an administrator', async () => {
    validateRegisteredUserAccessMock.mockResolvedValue({
      isAdmin: true,
      userId: 'admin-1'
    })

    const { dbWrite, itemValuesMock } = createDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)
    await createItemSubmissionHandler(createTestEvent({}))
    expect(getItemSubmissionRateLimiterBindingMock).not.toHaveBeenCalled()
    expect(itemSubmissionLimitMock).not.toHaveBeenCalled()

    expect(itemValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'admin-1'
    }))
  })

  it('should insert normalized non-empty properties in the same transaction', async () => {
    readValidatedBodyMock.mockResolvedValue({
      brandId: 1,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      sourceUrl: 'https://example.com/product',

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
      sourceUrl: 'https://example.com/product',

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

    validateRegisteredUserAccessMock.mockRejectedValue(authError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 401
    })

    expect(readValidatedBodyMock).not.toHaveBeenCalled()
    expect(getItemSubmissionRateLimiterBindingMock).not.toHaveBeenCalled()
    expect(itemSubmissionLimitMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should reject a Guest before validating the body or opening the write client', async () => {
    const guestError = h3.createError({ status: 403 })

    validateRegisteredUserAccessMock.mockRejectedValue(guestError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 403
    })

    expect(readValidatedBodyMock).not.toHaveBeenCalled()
    expect(getItemSubmissionRateLimiterBindingMock).not.toHaveBeenCalled()
    expect(itemSubmissionLimitMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    'not a URL'
  ])('should reject source URL %j through body validation before rate limiting or writes', async (sourceUrl) => {
    const actualH3 = await vi.importActual<typeof h3>('h3')

    readValidatedBodyMock.mockImplementationOnce(actualH3.readValidatedBody)

    const event = createTestEvent({})

    const body = JSON.stringify({
      brandId: 1,
      categoryId: 2,
      name: 'Item',
      sourceUrl
    })

    event.node.req.method = 'POST'
    event.node.req.headers['content-type'] = 'application/json'

    event.node.req.push(body)

    // oxlint-disable-next-line unicorn/prefer-single-call -- Readable streams end with a separate null chunk.
    event.node.req.push(null)
    await expect(createItemSubmissionHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(getItemSubmissionRateLimiterBindingMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should validate the body before opening the write client', async () => {
    const bodyError = h3.createError({ status: 400 })

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 400
    })

    expect(getItemSubmissionRateLimiterBindingMock).not.toHaveBeenCalled()
    expect(itemSubmissionLimitMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should reject a limited user with telemetry and no write-side effects', async () => {
    const consoleWarnMock = vi.spyOn(console, 'warn')

    itemSubmissionLimitMock.mockResolvedValue({ success: false })

    const event = createTestEvent({})

    await expect(createItemSubmissionHandler(event)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'Too many item submission attempts'
    })

    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)

    expect(consoleWarnMock).toHaveBeenCalledWith({
      event: 'rate_limit_rejected',
      operation: 'submit_equipment_item',
      userId: 'user-1'
    })

    expect(itemSubmissionLimitMock).toHaveBeenCalledTimes(1)
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(setResponseStatusMock).not.toHaveBeenCalled()
  })

  it('should fail closed when the limiter binding is unavailable', async () => {
    const bindingError = h3.createError({
      status: 503,
      statusMessage: 'Item submission rate limiter unavailable'
    })

    const consoleErrorMock = vi.spyOn(console, 'error')

    getItemSubmissionRateLimiterBindingMock.mockImplementationOnce(() => {
      throw bindingError
    })

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      cause: bindingError,
      statusCode: 503,
      statusMessage: 'Item submission is temporarily unavailable'
    })

    expect(consoleErrorMock).toHaveBeenCalledWith({
      error: bindingError,
      event: 'rate_limit_failed',
      operation: 'submit_equipment_item',
      userId: 'user-1'
    })

    expect(itemSubmissionLimitMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(setResponseStatusMock).not.toHaveBeenCalled()
  })

  it('should fail closed with the original limiter error and no write client', async () => {
    const limiterError = new Error('raw limiter failure')
    const consoleErrorMock = vi.spyOn(console, 'error')

    itemSubmissionLimitMock.mockRejectedValue(limiterError)

    await expect(createItemSubmissionHandler(createTestEvent({}))).rejects.toMatchObject({
      cause: limiterError,
      statusCode: 503,
      statusMessage: 'Item submission is temporarily unavailable'
    })

    expect(consoleErrorMock).toHaveBeenCalledWith({
      error: limiterError,
      event: 'rate_limit_failed',
      operation: 'submit_equipment_item',
      userId: 'user-1'
    })

    expect(itemSubmissionLimitMock).toHaveBeenCalledWith({
      key: 'submit_equipment_item:user:user-1'
    })

    expect(itemSubmissionLimitMock).toHaveBeenCalledTimes(1)
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(setResponseStatusMock).not.toHaveBeenCalled()
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
