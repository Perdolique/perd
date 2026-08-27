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

interface CreateReviewDbOptions {
  imageInsertError?: Error;
  itemStatus?: string;
  previousDisplayOrder?: number;
  submissionStatus?: string;
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
  const submissionLock = createLockBuilder({
    cloudflareImageId,
    createdBy: userId,
    filename,
    itemId,
    rightsConfirmed: true,
    status: options.submissionStatus ?? 'pending'
  })

  const itemLock = createLockBuilder({
    id: itemId,
    status: options.itemStatus ?? 'approved'
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

  const updateCalls: {
    table: unknown;
    values: Record<string, unknown> & { displayOrder?: SQL; };
  }[] = []

  const updateMock = vi.fn((table: unknown) => {
    return {
      set(values: Record<string, unknown> & { displayOrder?: SQL; }) {
        updateCalls.push({
          table,
          values
        })

        return {
          where: vi.fn()
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

  /* oxlint-disable promise/prefer-await-to-callbacks -- The mock executes Drizzle's transaction callback. */
  const transactionMock = vi.fn(async (
    callback: (value: typeof transaction) => Promise<unknown>
  ) => callback(transaction))

  const endMock = vi.fn()

  return {
    db: {
      $client: { end: endMock },
      transaction: transactionMock
    },

    contributionValuesMock,
    endMock,
    imageValuesMock,
    itemLock,
    submissionLock,
    updateCalls
  }
}

function expectDefinedSql(value: SQL | undefined): asserts value is SQL {
  expect(value).toBeDefined()
}

function createReviewEvent() {
  const event = createTestEvent({})

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

  it('should reject atomically without reading or changing the hosted image', async () => {
    const database = createReviewDb()

    createWebSocketClientMock.mockReturnValue(database.db)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'reject',
      rejectionReason: 'Duplicate photo'
    })

    const result = await updateHandler(createTestEvent({}))

    expect(getCloudflareImagesBindingMock).not.toHaveBeenCalled()
    expect(sourceImageBytesMock).not.toHaveBeenCalled()
    expect(imageUploadMock).not.toHaveBeenCalled()
    expect(database.updateCalls).toContainEqual({
      table: equipmentItemPhotoSubmissions,

      values: {
        rejectionReason: 'Duplicate photo',
        status: 'rejected'
      }
    })
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
  })

  it('should re-upload the private hosted image publicly at the gallery tail', async () => {
    const database = createReviewDb({ previousDisplayOrder: 1 })

    createWebSocketClientMock.mockReturnValue(database.db)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    const result = await updateHandler(createReviewEvent())

    await waitForBackgroundTasks()

    expect(sourceImageBytesMock).toHaveBeenCalledTimes(1)
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
    expect(database.contributionValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'publish_item_photo_submission',
      targetId: submissionId,
      userId
    }))
    expect(result).toStrictEqual({
      publishedImage: {
        displayOrder: 2,
        id: imageId,
        isPrimary: false
      },

      rejectionReason: null,
      status: 'approved'
    })
  })

  it('should shift existing image orders through a collision-free offset before primary insert', async () => {
    const database = createReviewDb({ previousDisplayOrder: 1 })

    createWebSocketClientMock.mockReturnValue(database.db)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: true
    })

    await updateHandler(createReviewEvent())

    await waitForBackgroundTasks()

    const imageOrderUpdates = database.updateCalls.filter(
      (call) => call.table === equipmentItemImages
    )

    expect(imageOrderUpdates).toHaveLength(2)

    const dialect = new PgDialect()
    const temporaryOrder = imageOrderUpdates[0]?.values.displayOrder
    const finalOrder = imageOrderUpdates[1]?.values.displayOrder

    expectDefinedSql(temporaryOrder)
    expectDefinedSql(finalOrder)

    expect(dialect.sqlToQuery(temporaryOrder).sql).toContain('+ $1')
    expect(dialect.sqlToQuery(temporaryOrder).params).toStrictEqual([3])
    expect(dialect.sqlToQuery(finalOrder).sql).toContain('- $1 + 1')
    expect(dialect.sqlToQuery(finalOrder).params).toStrictEqual([3])
    expect(database.imageValuesMock).toHaveBeenCalledWith({
      cloudflareImageId: publishedCloudflareImageId,
      displayOrder: 0,
      itemId
    })
  })

  it.each(['approved', 'rejected'])(
    'should return 409 for an already %s submission before provider or database writes',
    async (submissionStatus) => {
      const database = createReviewDb({ submissionStatus })

      createWebSocketClientMock.mockReturnValue(database.db)
      readValidatedBodyMock.mockResolvedValue({
        decision: 'publish',
        makePrimary: false
      })

      await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({ statusCode: 409 })
      expect(sourceImageBytesMock).not.toHaveBeenCalled()
      expect(imageUploadMock).not.toHaveBeenCalled()
      expect(database.imageValuesMock).not.toHaveBeenCalled()
      expect(database.contributionValuesMock).not.toHaveBeenCalled()
    }
  )

  it('should roll back without database writes when Cloudflare publication fails', async () => {
    const providerError = new Error('provider secret')
    const database = createReviewDb()

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected provider failure telemetry.
    })

    imageUploadMock.mockRejectedValue(providerError)
    createWebSocketClientMock.mockReturnValue(database.db)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Photo publication failed'
    })
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

  it('should delete the unattached public image when the database fails after publication', async () => {
    const databaseError = new Error('database unavailable')
    const database = createReviewDb({ imageInsertError: databaseError })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(database.db)
    readValidatedBodyMock.mockResolvedValue({
      decision: 'publish',
      makePrimary: false
    })

    await expect(updateHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to review photo submission'
    })
    expect(imageUploadMock).toHaveBeenCalledTimes(1)
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
  })
})
