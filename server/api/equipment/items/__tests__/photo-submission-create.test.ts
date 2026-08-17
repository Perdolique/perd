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
const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const cloudflareImageId = 'cloudflare-submission-1'
const filename = 'PocketRocket official.webp'
const sourceUrl = 'https://www.msrgear.com/products/pocketrocket'
const contentType = 'multipart/form-data; boundary=test-boundary'
const defaultReadItem = { id: itemId }

const {
  createEquipmentItemImageBodyMock,
  createWebSocketClientMock,
  deleteUnattachedHostedEquipmentImageMock,
  getCloudflareImagesBindingMock,
  getValidatedRouterParamsMock,
  readLimitedMultipartFormDataMock,
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
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    readLimitedMultipartFormDataMock: vi.fn<typeof readLimitedMultipartFormData>(),
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

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return {
    getCloudflareImagesBinding: getCloudflareImagesBindingMock
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

function createReadDb(item: { id: string; } | null = defaultReadItem) {
  return {
    query: {
      equipmentItems: {
        findFirst: vi.fn(() => item ?? undefined)
      }
    }
  }
}

function createWriteDb(options: { insertError?: Error; } = {}) {
  const submissionValuesMock = vi.fn(() => {
    return {
      returning: vi.fn(() => {
        if (options.insertError !== undefined) {
          throw options.insertError
        }

        return [{
          id: submissionId,
          status: 'pending'
        }]
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

  const transaction = { insert: insertMock }

  const transactionMock = vi.fn(async (
    executeTransaction: (value: typeof transaction) => Promise<unknown>
  ) => executeTransaction(transaction))

  const endMock = vi.fn()

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
    submissionValuesMock
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

describe('post /api/equipment/items/[id]/photo-submissions', () => {
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
    getCloudflareImagesBindingMock.mockReturnValue({ binding: 'images' })
    getValidatedRouterParamsMock.mockResolvedValue({ id: itemId })
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
  ])('should upload one private $sourceType asset and atomically create the pending submission', async ({
    expectedSourceUrl,
    sourceType
  }) => {
    const writeDb = createWriteDb()
    const readDb = createReadDb()
    const event = createTestEvent(readDb)

    createWebSocketClientMock.mockReturnValue(writeDb.db)
    readLimitedMultipartFormDataMock.mockResolvedValue(createSubmissionFormData(sourceType))

    const result = await createPhotoSubmissionHandler(event)
    const createBodyOptions = createEquipmentItemImageBodyMock.mock.calls[0]?.[0]
    const uploadOptions = uploadHostedEquipmentImageMock.mock.calls[0]?.[0]

    expect(readDb.query.equipmentItems.findFirst).toHaveBeenCalledWith({
      columns: {
        id: true
      },

      where: {
        id: itemId,
        status: 'approved'
      }
    })
    expect(validatePhotoSubmissionMultipartRequestMock).toHaveBeenCalledWith(event)
    expect(readLimitedMultipartFormDataMock).toHaveBeenCalledWith(event, contentType)
    expect(createBodyOptions?.declaredByteLength).toBe(10)
    expect(createBodyOptions?.mediaType).toBe('image/webp')
    expect(createBodyOptions?.stream).toBeInstanceOf(ReadableStream)
    expect(uploadOptions).toMatchObject({
      binding: { binding: 'images' },
      creator: userId,
      filename,

      metadata: {
        itemId,
        kind: 'equipment-photo-submission'
      },

      requireSignedURLs: true
    })
    expect(uploadOptions?.body).toBeDefined()
    expect(writeDb.submissionValuesMock).toHaveBeenCalledWith({
      cloudflareImageId,
      createdBy: userId,
      filename,
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
    expect(writeDb.db.transaction).toHaveBeenCalledTimes(1)
    expect(result).toStrictEqual({
      id: submissionId,
      status: 'pending'
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(writeDb.endMock).toHaveBeenCalledTimes(1)
  })

  it('should reject a non-approved item before parsing or uploading the body', async () => {
    const readDb = createReadDb(null)

    await expect(createPhotoSubmissionHandler(createTestEvent(readDb))).rejects.toMatchObject({
      statusCode: 404
    })
    expect(readLimitedMultipartFormDataMock).not.toHaveBeenCalled()
    expect(createEquipmentItemImageBodyMock).not.toHaveBeenCalled()
    expect(uploadHostedEquipmentImageMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
  })

  it('should require a registered user before validating or reading the request', async () => {
    const authError = createError({ status: 403 })

    validateRegisteredUserMock.mockRejectedValue(authError)

    await expect(createPhotoSubmissionHandler(createTestEvent(createReadDb()))).rejects.toBe(authError)
    expect(getValidatedRouterParamsMock).not.toHaveBeenCalled()
    expect(validatePhotoSubmissionMultipartRequestMock).not.toHaveBeenCalled()
  })

  it('should delete the unattached asset and close database resources after a database failure', async () => {
    const databaseError = new Error('database unavailable')
    const writeDb = createWriteDb({ insertError: databaseError })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(writeDb.db)

    await expect(createPhotoSubmissionHandler(createTestEvent(createReadDb()))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to save photo submission'
    })
    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledWith({
      binding: { binding: 'images' },
      cloudflareImageId
    })
    expect(writeDb.endMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to save equipment photo submission',
      expect.objectContaining({ error: databaseError })
    )
  })
})
