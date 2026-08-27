import type * as h3 from 'h3'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage
} from '#server/utils/equipment/item-images'

import type {
  readLimitedMultipartFormData,
  validatePhotoSubmissionMultipartRequest
} from '#server/utils/equipment/photo-submission-form'

import { contributions, equipmentItemImages, equipmentItemPhotoSubmissions } from '#server/database/schema'
import createPhotoSubmissionHandler from '#server/api/equipment/items/[id]/photo-submissions/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const otherItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d6'
const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const winnerSubmissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000'
const cloudflareImageId = 'cloudflare-submission-1'
const winnerCloudflareImageId = 'cloudflare-submission-winner'
const filename = 'PocketRocket official.webp'
const sourceUrl = 'https://www.msrgear.com/products/pocketrocket'
const contentType = 'multipart/form-data; boundary=test-boundary'

interface PersistedSubmissionRow {
  cloudflareImageId: string;
  id: string;
  itemId: string;
  status: string;
}

const {
  createEquipmentItemImageBodyMock,
  createWebSocketClientMock,
  deleteUnattachedHostedEquipmentImageMock,
  getCloudflareImagesBindingMock,
  getPhotoSubmissionRateLimiterBindingMock,
  getValidatedRouterParamsMock,
  readLimitedMultipartFormDataMock,
  setResponseHeaderMock,
  setResponseStatusMock,
  uploadHostedEquipmentImageMock,
  validatePhotoSubmissionMultipartRequestMock,
  validateRegisteredUserMock
} = vi.hoisted(() => {
  return {
    createEquipmentItemImageBodyMock: vi.fn<typeof createEquipmentItemImageBody>(),
    createWebSocketClientMock: vi.fn(),
    deleteUnattachedHostedEquipmentImageMock: vi.fn<typeof deleteUnattachedHostedEquipmentImage>(),
    getCloudflareImagesBindingMock: vi.fn(),
    getPhotoSubmissionRateLimiterBindingMock: vi.fn(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    readLimitedMultipartFormDataMock: vi.fn<typeof readLimitedMultipartFormData>(),
    setResponseHeaderMock: vi.fn<typeof h3.setResponseHeader>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    uploadHostedEquipmentImageMock: vi.fn<typeof uploadHostedEquipmentImage>(),
    validatePhotoSubmissionMultipartRequestMock: vi.fn<typeof validatePhotoSubmissionMultipartRequest>(),
    validateRegisteredUserMock: vi.fn()
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

    setResponseHeader(...args: Parameters<typeof h3.setResponseHeader>) {
      setResponseHeaderMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return {
    getCloudflareImagesBinding: getCloudflareImagesBindingMock,
    getPhotoSubmissionRateLimiterBinding: getPhotoSubmissionRateLimiterBindingMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

vi.mock(import('#server/utils/equipment/item-images'), () => {
  return {
    createEquipmentItemImageBody: createEquipmentItemImageBodyMock,
    deleteUnattachedHostedEquipmentImage: deleteUnattachedHostedEquipmentImageMock,
    uploadHostedEquipmentImage: uploadHostedEquipmentImageMock
  }
})

vi.mock(import('#server/utils/equipment/photo-submission-form'), () => {
  return {
    readLimitedMultipartFormData: readLimitedMultipartFormDataMock,
    validatePhotoSubmissionMultipartRequest: validatePhotoSubmissionMultipartRequestMock
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    validateRegisteredUser: validateRegisteredUserMock
  }
})

function createPersistedSubmission(options: {
  cloudflareImageId?: string;
  id?: string;
  itemId?: string;
  status?: 'approved' | 'pending' | 'rejected';
} = {}): PersistedSubmissionRow {
  return {
    cloudflareImageId: options.cloudflareImageId ?? cloudflareImageId,
    id: options.id ?? submissionId,
    itemId: options.itemId ?? itemId,
    status: options.status ?? 'pending'
  }
}

function createReadDb(options: {
  earlySubmission?: PersistedSubmissionRow;
  item?: { id: string; } | null;
  pendingCount?: number;
  reconciliationError?: Error;
  reconciledSubmission?: PersistedSubmissionRow;
} = {}) {
  const equipmentItemFindFirstMock = vi.fn(() => options.item === null
    ? undefined
    : options.item ?? { id: itemId })

  const submissionFindFirstMock = vi.fn()
    .mockResolvedValueOnce(options.earlySubmission)

  if (options.reconciliationError === undefined) {
    submissionFindFirstMock.mockResolvedValueOnce(options.reconciledSubmission)
  } else {
    submissionFindFirstMock.mockRejectedValueOnce(options.reconciliationError)
  }

  const submissionFindManyMock = vi.fn(() => Array.from(
    { length: options.pendingCount ?? 0 },
    (_value, index) => {
      return { id: `pending-${index}` }
    }
  ))

  return {
    db: {
      query: {
        equipmentItemPhotoSubmissions: {
          findFirst: submissionFindFirstMock,
          findMany: submissionFindManyMock
        },

        equipmentItems: {
          findFirst: equipmentItemFindFirstMock
        }
      }
    },

    equipmentItemFindFirstMock,
    submissionFindFirstMock,
    submissionFindManyMock
  }
}

function createSelectBuilder(rows: unknown[]) {
  const builder = {
    for: vi.fn(async () => {
      await Promise.resolve()

      return rows
    }),

    from: vi.fn(),

    limit: vi.fn(async () => {
      await Promise.resolve()

      return rows
    }),

    where: vi.fn()
  }

  builder.from.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)

  return builder
}

function createWriteDb(options: {
  endError?: Error;
  existingSubmission?: PersistedSubmissionRow;
  insertError?: Error;
  lockedItem?: { id: string; } | null;
  pendingCount?: number;
  transactionErrorAfterCallback?: Error;
} = {}) {
  const lockBuilder = createSelectBuilder(
    options.lockedItem === null ? [] : [options.lockedItem ?? { id: itemId }]
  )

  const existingSubmissionBuilder = createSelectBuilder(
    options.existingSubmission === undefined ? [] : [options.existingSubmission]
  )

  const pendingSubmissionsBuilder = createSelectBuilder(Array.from(
    { length: options.pendingCount ?? 0 },
    (_value, index) => {
      return { id: `pending-${index}` }
    }
  ))

  const selectMock = vi.fn()
    .mockReturnValueOnce(lockBuilder)
    .mockReturnValueOnce(existingSubmissionBuilder)
    .mockReturnValueOnce(pendingSubmissionsBuilder)

  const submissionValuesMock = vi.fn(() => {
    return {
      returning: vi.fn(() => {
        if (options.insertError !== undefined) {
          throw options.insertError
        }

        return [createPersistedSubmission()]
      })
    }
  })

  const contributionValuesMock = vi.fn()

  const insertMock = vi.fn((table) => {
    if (table === equipmentItemPhotoSubmissions) {
      return { values: submissionValuesMock }
    }

    if (table === contributions) {
      return { values: contributionValuesMock }
    }

    throw new Error('Unexpected table insert')
  })

  const transaction = {
    insert: insertMock,
    select: selectMock
  }

  const transactionMock = vi.fn(async (
    executeTransaction: (value: typeof transaction) => Promise<unknown>
  ) => {
    const result = await executeTransaction(transaction)

    if (options.transactionErrorAfterCallback !== undefined) {
      throw options.transactionErrorAfterCallback
    }

    return result
  })

  const endMock = options.endError === undefined
    ? vi.fn(async () => {
      await Promise.resolve()
    })
    : vi.fn().mockRejectedValue(options.endError)

  return {
    db: {
      $client: {
        end: endMock
      },

      transaction: transactionMock
    },

    contributionValuesMock,
    endMock,
    insertMock,
    lockBuilder,
    pendingSubmissionsBuilder,
    submissionValuesMock,
    transactionMock
  }
}

function createSubmissionFormData(sourceType: 'manufacturer' | 'own'): FormData {
  const formData = new FormData()
  const photo = new File(['valid-webp'], filename, { type: 'image/webp' })

  formData.append('photo', photo)
  formData.append('rightsConfirmed', 'true')
  formData.append('sourceType', sourceType)

  if (sourceType === 'manufacturer') {
    formData.append('sourceUrl', sourceUrl)
  }

  return formData
}

function createPhotoSubmissionEvent(dbHttp: unknown, key: string | null = idempotencyKey) {
  const event = createTestEvent(dbHttp)

  if (key !== null) {
    event.node.req.headers['idempotency-key'] = key
  }

  return event
}

describe('post /api/equipment/items/[id]/photo-submissions', () => {
  const rateLimitMock = vi.fn<Env['PHOTO_SUBMISSION_RATE_LIMITER']['limit']>()

  beforeEach(() => {
    vi.clearAllMocks()

    const body = {
      close: vi.fn(),
      isLimitExceeded: () => false,
      mediaType: 'image/webp',
      stream: new ReadableStream<Uint8Array>()
    }

    const writeDb = createWriteDb()

    createEquipmentItemImageBodyMock.mockResolvedValue(body)
    createWebSocketClientMock.mockReturnValue(writeDb.db)
    deleteUnattachedHostedEquipmentImageMock.mockResolvedValue()
    getCloudflareImagesBindingMock.mockReturnValue({ binding: 'images' })
    getPhotoSubmissionRateLimiterBindingMock.mockReturnValue({ limit: rateLimitMock })
    getValidatedRouterParamsMock.mockResolvedValue({ id: itemId })
    rateLimitMock.mockResolvedValue({ success: true })
    readLimitedMultipartFormDataMock.mockResolvedValue(createSubmissionFormData('manufacturer'))
    uploadHostedEquipmentImageMock.mockResolvedValue(cloudflareImageId)
    validatePhotoSubmissionMultipartRequestMock.mockReturnValue(contentType)
    validateRegisteredUserMock.mockResolvedValue(userId)
  })

  it.each([
    {
      expectedSourceUrl: sourceUrl,
      sourceType: 'manufacturer' as const
    },
    {
      expectedSourceUrl: null,
      sourceType: 'own' as const
    }
  ])('should rate-limit, upload, lock, and atomically create one $sourceType submission', async ({
    expectedSourceUrl,
    sourceType
  }) => {
    const writeDb = createWriteDb()
    const readDb = createReadDb()
    const event = createPhotoSubmissionEvent(readDb.db)

    createWebSocketClientMock.mockReturnValue(writeDb.db)
    readLimitedMultipartFormDataMock.mockResolvedValue(createSubmissionFormData(sourceType))

    const result = await createPhotoSubmissionHandler(event)

    expect(rateLimitMock).toHaveBeenCalledWith({ key: userId })
    expect(readDb.submissionFindManyMock).toHaveBeenCalledWith({
      columns: { id: true },

      where: {
        createdBy: userId,
        itemId,
        status: 'pending'
      },

      limit: 3
    })
    expect(validatePhotoSubmissionMultipartRequestMock).toHaveBeenCalledWith(event)
    expect(writeDb.lockBuilder.for).toHaveBeenCalledWith('update')
    expect(writeDb.submissionValuesMock).toHaveBeenCalledWith({
      cloudflareImageId,
      createdBy: userId,
      filename,
      idempotencyKey,
      itemId,
      rightsConfirmed: true,
      sourceType,
      sourceUrl: expectedSourceUrl,
      status: 'pending'
    })
    expect(writeDb.contributionValuesMock).toHaveBeenCalledWith({
      action: 'submit_item_photo',

      metadata: {
        filename,
        itemId,
        sourceType,
        status: 'pending'
      },

      targetId: submissionId,
      userId
    })
    expect(writeDb.insertMock).not.toHaveBeenCalledWith(equipmentItemImages)
    expect(result).toStrictEqual({
      id: submissionId,
      status: 'pending'
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(writeDb.endMock).toHaveBeenCalledTimes(1)
  })

  it.each([null, 'not-a-uuid'])('should reject a missing or invalid idempotency key: %s', async (key) => {
    const readDb = createReadDb()

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db, key))
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(readDb.submissionFindFirstMock).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
  })

  it('should return a completed idempotent replay before consuming a rate token', async () => {
    const existingSubmission = createPersistedSubmission()
    const readDb = createReadDb({ earlySubmission: existingSubmission })
    const event = createPhotoSubmissionEvent(readDb.db)
    const result = await createPhotoSubmissionHandler(event)

    expect(result).toStrictEqual({
      id: submissionId,
      status: 'pending'
    })
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(readLimitedMultipartFormDataMock).not.toHaveBeenCalled()
    expect(uploadHostedEquipmentImageMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it.each(['approved', 'rejected'] as const)(
    'should replay an already %s submission without uploading another image',
    async (status) => {
      const existingSubmission = createPersistedSubmission({ status })
      const readDb = createReadDb({ earlySubmission: existingSubmission })
      const event = createPhotoSubmissionEvent(readDb.db)
      const result = await createPhotoSubmissionHandler(event)

      expect(result).toStrictEqual({
        id: submissionId,
        status
      })
      expect(rateLimitMock).not.toHaveBeenCalled()
      expect(uploadHostedEquipmentImageMock).not.toHaveBeenCalled()
      expect(createWebSocketClientMock).not.toHaveBeenCalled()
    }
  )

  it('should reject an idempotency key already used for another item', async () => {
    const readDb = createReadDb({
      earlySubmission: createPersistedSubmission({ itemId: otherItemId })
    })

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(rateLimitMock).not.toHaveBeenCalled()
  })

  it('should reject a full pending quota before rate limiting or uploading', async () => {
    const readDb = createReadDb({ pendingCount: 3 })

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(readLimitedMultipartFormDataMock).not.toHaveBeenCalled()
    expect(uploadHostedEquipmentImageMock).not.toHaveBeenCalled()
  })

  it('should reject a new attempt with Retry-After when the burst limit is exhausted', async () => {
    const readDb = createReadDb()
    const event = createPhotoSubmissionEvent(readDb.db)

    rateLimitMock.mockResolvedValue({ success: false })

    await expect(createPhotoSubmissionHandler(event)).rejects.toMatchObject({ statusCode: 429 })
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'retry-after', 60)
    expect(readLimitedMultipartFormDataMock).not.toHaveBeenCalled()
    expect(uploadHostedEquipmentImageMock).not.toHaveBeenCalled()
  })

  it('should fail closed before reading the body when the rate limiter is unavailable', async () => {
    const limiterError = new Error('limiter unavailable')

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected limiter failure telemetry.
    })

    rateLimitMock.mockRejectedValue(limiterError)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(createReadDb().db))
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(readLimitedMultipartFormDataMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to apply photo submission rate limit',
      {
        error: limiterError,
        userId
      }
    )
  })

  it('should delete a concurrent losing upload only after closing database resources', async () => {
    const winner = createPersistedSubmission({
      cloudflareImageId: winnerCloudflareImageId,
      id: winnerSubmissionId
    })

    const writeDb = createWriteDb({ existingSubmission: winner })
    const readDb = createReadDb()

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    const result = await createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))

    expect(result.id).toBe(winnerSubmissionId)
    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledWith({
      binding: { binding: 'images' },
      cloudflareImageId
    })
    expect(Math.max(...writeDb.endMock.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...deleteUnattachedHostedEquipmentImageMock.mock.invocationCallOrder)
    )
    expect(writeDb.insertMock).not.toHaveBeenCalled()
  })

  it('should preserve the uploaded asset when reconciliation proves an unknown commit succeeded', async () => {
    const transactionError = new Error('commit acknowledgement lost')
    const persistedSubmission = createPersistedSubmission()
    const writeDb = createWriteDb({ transactionErrorAfterCallback: transactionError })
    const readDb = createReadDb({ reconciledSubmission: persistedSubmission })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    const result = await createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))

    expect(result.id).toBe(submissionId)
    expect(deleteUnattachedHostedEquipmentImageMock).not.toHaveBeenCalled()
    expect(writeDb.endMock).toHaveBeenCalledTimes(1)
  })

  it('should delete the losing asset when reconciliation finds another committed winner', async () => {
    const winner = createPersistedSubmission({
      cloudflareImageId: winnerCloudflareImageId,
      id: winnerSubmissionId
    })

    const writeDb = createWriteDb({
      transactionErrorAfterCallback: new Error('unique race')
    })

    const readDb = createReadDb({ reconciledSubmission: winner })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    const result = await createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))

    expect(result.id).toBe(winnerSubmissionId)
    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledWith({
      binding: { binding: 'images' },
      cloudflareImageId
    })
    expect(Math.max(...writeDb.endMock.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...deleteUnattachedHostedEquipmentImageMock.mock.invocationCallOrder)
    )
  })

  it('should delete a proven unattached asset and preserve the transaction error', async () => {
    const transactionError = new Error('database unavailable')
    const writeDb = createWriteDb({ insertError: transactionError })
    const readDb = createReadDb()

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to save photo submission'
    })
    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledWith({
      binding: { binding: 'images' },
      cloudflareImageId
    })
    expect(Math.max(...writeDb.endMock.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...deleteUnattachedHostedEquipmentImageMock.mock.invocationCallOrder)
    )
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to save equipment photo submission',
      expect.objectContaining({ error: transactionError })
    )
  })

  it('should retain the uploaded asset when reconciliation itself fails', async () => {
    const reconciliationError = new Error('read unavailable')
    const writeDb = createWriteDb({ insertError: new Error('write unavailable') })
    const readDb = createReadDb({ reconciliationError })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected reconciliation failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(deleteUnattachedHostedEquipmentImageMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to reconcile equipment photo submission',
      expect.objectContaining({ reconciliationError })
    )
  })

  it('should reject a quota race inside the item lock and clean up after closing the pool', async () => {
    const writeDb = createWriteDb({ pendingCount: 3 })
    const readDb = createReadDb()

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledTimes(1)
    expect(Math.max(...writeDb.endMock.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...deleteUnattachedHostedEquipmentImageMock.mock.invocationCallOrder)
    )
  })

  it('should log a pool close failure without changing a committed success', async () => {
    const endError = new Error('pool close failed')
    const writeDb = createWriteDb({ endError })
    const readDb = createReadDb()

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected pool cleanup telemetry.
    })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(readDb.db))
    ).resolves.toStrictEqual({
      id: submissionId,
      status: 'pending'
    })
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to close photo submission database client',
      {
        error: endError,
        itemId
      }
    )
  })

  it('should require a registered user before validating request inputs', async () => {
    const authError = createError({ status: 403 })

    validateRegisteredUserMock.mockRejectedValue(authError)

    await expect(
      createPhotoSubmissionHandler(createPhotoSubmissionEvent(createReadDb().db))
    ).rejects.toBe(authError)
    expect(getValidatedRouterParamsMock).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
  })
})
