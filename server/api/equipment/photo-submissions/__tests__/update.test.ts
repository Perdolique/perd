import type * as h3 from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contributions, equipmentItemImages, equipmentItemPhotoSubmissions } from '#server/database/schema'
import updateHandler from '#server/api/equipment/photo-submissions/[id].patch'
import { createTestEvent } from '~~/test-utils/create-test-event'

const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const imageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const cloudflareImageId = 'private-photo-image'
const publishedCloudflareImageId = 'public-photo-image'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const filename = 'submitted-photo.webp'
const waitUntilMock = vi.fn<(promise: Promise<unknown>) => void>()

const {
  createWebSocketClientMock,
  getCloudflareImagesBindingMock,
  getValidatedRouterParamsMock,
  readValidatedBodyMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn(),
    getCloudflareImagesBindingMock: vi.fn(),
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

vi.mock(import('#server/utils/cloudflare'), () => {
  return { getCloudflareImagesBinding: getCloudflareImagesBindingMock }
})

vi.mock(import('#server/utils/config'), () => {
  return { createWebSocketClientFromEvent: createWebSocketClientMock }
})

interface ReconciledImage {
  displayOrder: number;
  id: string;
}

interface CreateReviewDbOptions {
  imageInsertError?: Error;
  lockedItemStatus?: string;
  lockedSubmissionStatus?: string;
  preflightItemStatus?: string;
  preflightSubmissionStatus?: string;
  previousDisplayOrder?: number;
  reconciledImage?: ReconciledImage;
  reconciledSubmissionStatus?: string;
  reconciliationError?: Error;
  transactionErrorAfterCallback?: Error;
}

interface UpdateCall {
  table: unknown;
  values: Record<string, unknown> & { displayOrder?: SQL; };
  where: SQL | null;
}

function createLockBuilder(row: unknown) {
  const forMock = vi.fn(() => row === undefined ? [] : [row])

  const limitMock = vi.fn(() => {
    return { for: forMock }
  })

  const whereMock = vi.fn(() => {
    return { limit: limitMock }
  })

  const fromMock = vi.fn(() => {
    return { where: whereMock }
  })

  return {
    builder: { from: fromMock },
    forMock
  }
}

function createReviewDb(options: CreateReviewDbOptions = {}) {
  const preflightSubmission = {
    cloudflareImageId,
    createdBy: userId,
    filename,

    item: {
      status: options.preflightItemStatus ?? 'approved'
    },

    itemId,
    rightsConfirmed: true,
    status: options.preflightSubmissionStatus ?? 'pending'
  }

  const submissionFindFirstMock = vi.fn((query: { with?: unknown; }) => {
    if (query.with !== undefined) {
      return preflightSubmission
    }

    if (options.reconciliationError !== undefined) {
      throw options.reconciliationError
    }

    return {
      status: options.reconciledSubmissionStatus ?? 'pending'
    }
  })

  const imageFindFirstMock = vi.fn(() => options.reconciledImage)

  const submissionLock = createLockBuilder({
    cloudflareImageId,
    itemId,
    rightsConfirmed: true,
    status: options.lockedSubmissionStatus ?? 'pending'
  })

  const itemLock = createLockBuilder({
    id: itemId,
    status: options.lockedItemStatus ?? options.preflightItemStatus ?? 'approved'
  })

  const displayOrderWhereMock = vi.fn(() => [{
    displayOrder: options.previousDisplayOrder ?? 1
  }])

  const displayOrderFromMock = vi.fn(() => {
    return { where: displayOrderWhereMock }
  })

  const selectMock = vi.fn()
    .mockReturnValueOnce(submissionLock.builder)
    .mockReturnValueOnce(itemLock.builder)
    .mockReturnValueOnce({ from: displayOrderFromMock })

  const updateCalls: UpdateCall[] = []

  const updateMock = vi.fn((table: unknown) => {
    return {
      set(values: UpdateCall['values']) {
        const updateCall: UpdateCall = {
          table,
          values,
          where: null
        }

        updateCalls.push(updateCall)

        return {
          where: vi.fn((condition: SQL) => {
            updateCall.where = condition
          })
        }
      }
    }
  })

  const contributionValuesMock = vi.fn()

  const imageValuesMock = vi.fn(() => {
    return {
      returning: vi.fn(() => {
        if (options.imageInsertError !== undefined) {
          throw options.imageInsertError
        }

        const displayOrder = options.previousDisplayOrder === -1 ? 0 : 2

        return [{
          displayOrder,
          id: imageId
        }]
      })
    }
  })

  const insertMock = vi.fn((table: unknown) => {
    if (table === equipmentItemImages) {
      return { values: imageValuesMock }
    }

    if (table === contributions) {
      return { values: contributionValuesMock }
    }

    throw new Error('Unexpected insert table')
  })

  const transaction = {
    insert: insertMock,
    select: selectMock,
    update: updateMock
  }

  /* oxlint-disable node/callback-return, promise/prefer-await-to-callbacks -- The mock executes Drizzle's transaction callback. */
  const transactionMock = vi.fn(async (
    callback: (value: typeof transaction) => Promise<unknown>
  ) => {
    const result = await callback(transaction)

    if (options.transactionErrorAfterCallback !== undefined) {
      throw options.transactionErrorAfterCallback
    }

    return result
  })

  const endMock = vi.fn(async () => {
    // The Drizzle client closes successfully.
  })

  return {
    dbHttp: {
      query: {
        equipmentItemImages: {
          findFirst: imageFindFirstMock
        },

        equipmentItemPhotoSubmissions: {
          findFirst: submissionFindFirstMock
        }
      }
    },

    dbWebsocket: {
      $client: { end: endMock },
      transaction: transactionMock
    },

    contributionValuesMock,
    endMock,
    imageFindFirstMock,
    imageValuesMock,
    itemLock,
    submissionFindFirstMock,
    submissionLock,
    transactionMock,
    updateCalls
  }
}

function expectDefinedSql(value: SQL | null | undefined): asserts value is SQL {
  expect(value).toBeDefined()
  expect(value).not.toBeNull()
}

function getRequiredValue<Value>(value: Value | undefined, label: string): Value {
  if (value === undefined) {
    throw new Error(`Expected ${label}`)
  }

  return value
}

function expectWhereQuery(
  where: SQL | null,
  expectedSql: string,
  expectedParams: unknown[]
): void {
  expectDefinedSql(where)

  const query = new PgDialect().sqlToQuery(where)

  expect(query.sql).toContain(expectedSql)
  expect(query.params).toStrictEqual(expectedParams)
}

function findUpdateCall(
  updateCalls: UpdateCall[],
  table: unknown,
  status: string
): UpdateCall {
  const updateCall = updateCalls.find((call) => call.table === table && call.values.status === status)

  if (updateCall === undefined) {
    throw new Error(`Expected ${status} update call`)
  }

  return updateCall
}

function createReviewEvent(database: ReturnType<typeof createReviewDb>) {
  const event = createTestEvent(database.dbHttp)

  Object.assign(event, {
    waitUntil: waitUntilMock
  })

  return event
}

async function waitForBackgroundTasks(): Promise<void> {
  const backgroundPromises: Promise<unknown>[] = []

  for (const [promise] of waitUntilMock.mock.calls) {
    backgroundPromises.push(promise)
  }

  await Promise.all(backgroundPromises)
}

describe('patch /api/equipment/photo-submissions/[id]', () => {
  const imageUploadMock = vi.fn()
  const publishedImageDeleteMock = vi.fn()
  const sourceImageBytesMock = vi.fn()
  const sourceImageDeleteMock = vi.fn()
  let sourceImageBytes: ReadableStream<Uint8Array> | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue(userId)
    getValidatedRouterParamsMock.mockResolvedValue({ id: submissionId })
    sourceImageBytes = new ReadableStream<Uint8Array>()
    sourceImageBytesMock.mockResolvedValue(sourceImageBytes)
    sourceImageDeleteMock.mockResolvedValue(true)
    publishedImageDeleteMock.mockResolvedValue(true)
    imageUploadMock.mockResolvedValue({ id: publishedCloudflareImageId })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn((id: string) => {
          if (id === cloudflareImageId) {
            return {
              bytes: sourceImageBytesMock,
              delete: sourceImageDeleteMock
            }
          }

          if (id === publishedCloudflareImageId) {
            return { delete: publishedImageDeleteMock }
          }

          throw new Error(`Unexpected Cloudflare image ID: ${id}`)
        }),

        upload: imageUploadMock
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should reject atomically with a submission-scoped update', async () => {
    const database = createReviewDb()

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'reject',
      rejectionReason: 'Duplicate photo'
    })

    const result = await updateHandler(createReviewEvent(database))

    const rejectionUpdate = findUpdateCall(
      database.updateCalls,
      equipmentItemPhotoSubmissions,
      'rejected'
    )

    expectWhereQuery(
      rejectionUpdate.where,
      '"equipment_item_photo_submissions"."id" = $1',
      [submissionId]
    )
    expect(getCloudflareImagesBindingMock).not.toHaveBeenCalled()
    expect(sourceImageBytesMock).not.toHaveBeenCalled()
    expect(imageUploadMock).not.toHaveBeenCalled()
    expect(database.contributionValuesMock).toHaveBeenCalledWith({
      action: 'reject_item_photo_submission',

      metadata: {
        itemId,
        rejectionReason: 'Duplicate photo',
        status: 'rejected'
      },

      targetId: submissionId,
      userId
    })
    expect(result).toStrictEqual({
      publishedImage: null,
      rejectionReason: 'Duplicate photo',
      status: 'rejected'
    })
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })

  it('should prepare the public copy before the transaction and append it to the gallery', async () => {
    const database = createReviewDb({ previousDisplayOrder: 1 })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    const result = await updateHandler(createReviewEvent(database))

    await waitForBackgroundTasks()

    const imageUploadCallOrder = getRequiredValue(
      imageUploadMock.mock.invocationCallOrder[0],
      'Cloudflare upload call order'
    )

    const transactionCallOrder = getRequiredValue(
      database.transactionMock.mock.invocationCallOrder[0],
      'database transaction call order'
    )

    expect(imageUploadCallOrder).toBeLessThan(transactionCallOrder)
    expect(imageUploadMock).toHaveBeenCalledWith(sourceImageBytes, {
      creator: userId,
      filename,

      metadata: {
        itemId
      },

      requireSignedURLs: false
    })
    expect(sourceImageDeleteMock).toHaveBeenCalledTimes(1)
    expect(publishedImageDeleteMock).not.toHaveBeenCalled()
    expect(database.imageValuesMock).toHaveBeenCalledWith({
      cloudflareImageId: publishedCloudflareImageId,
      displayOrder: 2,
      itemId
    })
    expect(database.updateCalls.filter((call) => call.table === equipmentItemImages)).toHaveLength(0)
    expect(result).toStrictEqual({
      publishedImage: {
        displayOrder: 2,
        id: imageId,
        isPrimary: false
      },

      rejectionReason: null,
      status: 'approved'
    })
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })

  it('should scope both primary-order shifts and the approval update', async () => {
    const database = createReviewDb({ previousDisplayOrder: 1 })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: true
    })

    await updateHandler(createReviewEvent(database))
    await waitForBackgroundTasks()

    const imageOrderUpdates = database.updateCalls.filter(
      (call) => call.table === equipmentItemImages
    )

    expect(imageOrderUpdates).toHaveLength(2)

    const firstImageOrderUpdate = getRequiredValue(imageOrderUpdates[0], 'first image order update')
    const secondImageOrderUpdate = getRequiredValue(imageOrderUpdates[1], 'second image order update')

    expectWhereQuery(
      firstImageOrderUpdate.where,
      '"equipment_item_images"."itemId" = $1',
      [itemId]
    )
    expectWhereQuery(
      secondImageOrderUpdate.where,
      '"equipment_item_images"."itemId" = $1',
      [itemId, 1]
    )

    const approvalUpdate = findUpdateCall(
      database.updateCalls,
      equipmentItemPhotoSubmissions,
      'approved'
    )

    expectWhereQuery(
      approvalUpdate.where,
      '"equipment_item_photo_submissions"."id" = $1',
      [submissionId]
    )
    expect(database.imageValuesMock).toHaveBeenCalledWith({
      cloudflareImageId: publishedCloudflareImageId,
      displayOrder: 0,
      itemId
    })
  })

  it.each(['approved', 'rejected'])(
    'should return 409 for an already %s submission before provider or database writes',
    async (preflightSubmissionStatus) => {
      const database = createReviewDb({ preflightSubmissionStatus })

      readValidatedBodyMock.mockResolvedValue({
        decision: 'publish',
        makePrimary: false
      })

      await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({ statusCode: 409 })
      expect(sourceImageBytesMock).not.toHaveBeenCalled()
      expect(imageUploadMock).not.toHaveBeenCalled()
      expect(createWebSocketClientMock).not.toHaveBeenCalled()
      expect(database.imageValuesMock).not.toHaveBeenCalled()
      expect(database.contributionValuesMock).not.toHaveBeenCalled()
    }
  )

  it('should return 409 for an unpublished item before provider or database writes', async () => {
    const database = createReviewDb({ preflightItemStatus: 'rejected' })

    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Equipment item is no longer published'
    })
    expect(sourceImageBytesMock).not.toHaveBeenCalled()
    expect(imageUploadMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(database.imageValuesMock).not.toHaveBeenCalled()
    expect(database.contributionValuesMock).not.toHaveBeenCalled()
  })

  it('should delete a prepared copy when the item changes before the transaction lock', async () => {
    const database = createReviewDb({ lockedItemStatus: 'rejected' })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({ statusCode: 409 })
    expect(imageUploadMock).toHaveBeenCalledTimes(1)
    expect(publishedImageDeleteMock).toHaveBeenCalledTimes(1)
    expect(sourceImageDeleteMock).not.toHaveBeenCalled()
    expect(database.imageValuesMock).not.toHaveBeenCalled()
    expect(database.contributionValuesMock).not.toHaveBeenCalled()
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })

  it('should stop before opening a transaction when Cloudflare publication fails', async () => {
    const providerError = new Error('provider secret')
    const database = createReviewDb()

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected provider failure telemetry.
    })

    imageUploadMock.mockRejectedValue(providerError)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Photo publication failed'
    })
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(database.imageValuesMock).not.toHaveBeenCalled()
    expect(database.updateCalls).toHaveLength(0)
    expect(database.contributionValuesMock).not.toHaveBeenCalled()
    expect(sourceImageDeleteMock).not.toHaveBeenCalled()
    expect(publishedImageDeleteMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to publish Cloudflare photo submission image',
      {
        cloudflareImageId,
        error: providerError,
        submissionId
      }
    )
  })

  it('should delete the unattached public image when the database rolls back', async () => {
    const databaseError = new Error('database unavailable')
    const database = createReviewDb({ imageInsertError: databaseError })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to review photo submission'
    })
    expect(imageUploadMock).toHaveBeenCalledTimes(1)
    expect(database.submissionFindFirstMock).toHaveBeenCalledTimes(2)
    expect(database.imageFindFirstMock).toHaveBeenCalledTimes(1)
    expect(publishedImageDeleteMock).toHaveBeenCalledTimes(1)
    expect(sourceImageDeleteMock).not.toHaveBeenCalled()
    expect(database.contributionValuesMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to review equipment photo submission',
      {
        error: databaseError,
        submissionId
      }
    )
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })

  it('should preserve an attached public image when the commit acknowledgement is lost', async () => {
    const commitError = new Error('commit acknowledgement lost')

    const database = createReviewDb({
      reconciledImage: {
        displayOrder: 2,
        id: imageId
      },

      reconciledSubmissionStatus: 'approved',
      transactionErrorAfterCallback: commitError
    })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected reconciliation telemetry.
    })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    const result = await updateHandler(createReviewEvent(database))

    await waitForBackgroundTasks()

    expect(result).toStrictEqual({
      publishedImage: {
        displayOrder: 2,
        id: imageId,
        isPrimary: false
      },

      rejectionReason: null,
      status: 'approved'
    })
    expect(publishedImageDeleteMock).not.toHaveBeenCalled()
    expect(sourceImageDeleteMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Reconciled equipment photo publication after transaction failure',
      {
        cloudflareImageId: publishedCloudflareImageId,
        error: commitError,
        submissionId
      }
    )
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })

  it('should keep the public image when reconciliation itself fails', async () => {
    const databaseError = new Error('database unavailable')
    const reconciliationError = new Error('read-back unavailable')

    const database = createReviewDb({
      imageInsertError: databaseError,
      reconciliationError
    })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected reconciliation telemetry.
    })

    createWebSocketClientMock.mockReturnValue(database.dbWebsocket)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createReviewEvent(database))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to review photo submission'
    })
    expect(publishedImageDeleteMock).not.toHaveBeenCalled()
    expect(sourceImageDeleteMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to reconcile equipment photo publication',
      {
        cloudflareImageId: publishedCloudflareImageId,
        error: databaseError,
        reconciliationError,
        submissionId
      }
    )
    expect(database.endMock).toHaveBeenCalledTimes(1)
  })
})
