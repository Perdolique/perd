import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import createGroupHandler from '#server/api/equipment/groups/index.post'
import type { EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'
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

interface MockCreateDb {
  insert: ReturnType<typeof vi.fn>;
}

function createDb({
  createdGroup,
  insertError
}: {
  createdGroup?: EquipmentGroupBaseRecord;
  insertError?: Error;
} = {}) {
  const insertGroupReturningMock = vi.fn(() => {
    if (insertError !== undefined) {
      throw insertError
    }

    const createdRows = createdGroup === undefined ? [] : [createdGroup]

    return createdRows
  })

  const insertGroupValuesMock = vi.fn(() => {
    return {
      returning: insertGroupReturningMock
    }
  })

  const insertContributionValuesMock = vi.fn()
  const insertMock = vi.fn()

  insertMock
    .mockImplementationOnce(() => {
      return {
        values: insertGroupValuesMock
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

describe('POST /api/equipment/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    readValidatedBodyMock.mockResolvedValue({
      name: 'Sleep',
      slug: 'sleep'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should create a group and log a contribution', async () => {
    const createdGroup = {
      id: 7,
      name: 'Sleep',
      slug: 'sleep'
    }

    const { dbHttp, insertContributionValuesMock } = createDb({
      createdGroup
    })

    const event = createTestEvent(dbHttp)
    const result = await createGroupHandler(event)

    expect(result).toStrictEqual(createdGroup)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'create_group',

      metadata: {
        name: 'Sleep',
        slug: 'sleep'
      },

      targetId: '7',
      userId: 'user-1'
    })
  })

  test('should return 401 when user is unauthenticated', async () => {
    const authError = h3.createError({ status: 401 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  test('should return 403 when user is not an admin', async () => {
    const authError = h3.createError({ status: 403 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    validateAdminUserMock.mockRejectedValue(authError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 403
    })
  })

  test('should return 400 when body validation fails', async () => {
    const bodyError = h3.createError({ status: 400 })
    const { dbHttp } = createDb()
    const event = createTestEvent(dbHttp)

    readValidatedBodyMock.mockRejectedValue(bodyError)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  test('should return 500 when group creation fails', async () => {
    const { dbHttp } = createDb({
      insertError: new Error('insert failed')
    })
    const event = createTestEvent(dbHttp)

    await expect(createGroupHandler(event)).rejects.toMatchObject({
      message: 'Failed to create group',
      statusCode: 500
    })
  })
})
