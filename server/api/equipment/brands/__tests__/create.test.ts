import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import createBrandHandler from '#server/api/equipment/brands/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  readValidatedBodyMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    readValidatedBodyMock: vi.fn<typeof h3.readValidatedBody>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateAdminUserMock: vi.fn()
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

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

interface BrandRecord {
  id: number;
  name: string;
  slug: string;
}

interface MockCreateDb {
  insert: ReturnType<typeof vi.fn>;
}

function createDb({
  createdBrand,
  insertError
}: {
  createdBrand?: BrandRecord;
  insertError?: Error;
} = {}) {
  const insertBrandReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    const createdRows = createdBrand === undefined ? [] : [createdBrand]

    return createdRows
  })

  const insertBrandValuesMock = vi.fn(() => {
    return {
      returning: insertBrandReturningMock
    }
  })

  const insertContributionValuesMock = vi.fn()
  const insertMock = vi.fn()

  insertMock
    .mockImplementationOnce(() => {
      return {
        values: insertBrandValuesMock
      }
    })
    .mockImplementationOnce(() => {
      return {
        values: insertContributionValuesMock
      }
    })

  const dbHttp: MockCreateDb = {
    insert: insertMock
  }

  return {
    dbHttp,
    insertContributionValuesMock
  }
}

describe('POST /api/equipment/brands', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'MSR',
      slug: 'msr'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a brand and log a contribution', async () => {
    const createdBrand = {
      id: 12,
      name: 'MSR',
      slug: 'msr'
    }

    const { dbHttp, insertContributionValuesMock } = createDb({
      createdBrand
    })

    const event = createTestEvent(dbHttp)
    const result = await createBrandHandler(event)

    expect(result).toStrictEqual(createdBrand)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'create_brand',

      metadata: {
        name: 'MSR',
        slug: 'msr'
      },

      targetId: '12',
      userId: 'user-1'
    })
  })

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 500 when brand creation fails', async () => {
    const { dbHttp } = createDb({
      insertError: new Error('insert failed')
    })

    const event = createTestEvent(dbHttp)

    await expect(createBrandHandler(event)).rejects.toMatchObject({
      message: 'Failed to create brand',
      statusCode: 500
    })
  })
})
