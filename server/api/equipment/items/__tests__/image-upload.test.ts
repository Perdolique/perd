import type { getValidatedRouteParams } from '#server/utils/request'
import type * as nuxtServer from 'nuxt/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage
} from '#server/utils/equipment/item-images'

import uploadImageHandler from '#server/api/equipment/items/[id]/images/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const imageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const cloudflareImageId = 'cloudflare-image-1'
const filename = 'PocketRocket front.webp'

const {
  createEquipmentItemImageBodyMock,
  createWebSocketClientMock,
  deleteUnattachedHostedEquipmentImageMock,
  getCloudflareImagesBindingMock,
  getValidatedQueryMock,
  getValidatedRouteParamsMock,
  insertContributionValuesMock,
  setResponseStatusMock,
  uploadHostedEquipmentImageMock,
  validateAdminUserMock,
  validateEquipmentItemImageRequestMock
} = vi.hoisted(() => {
  return {
    createEquipmentItemImageBodyMock: vi.fn<typeof createEquipmentItemImageBody>(),
    createWebSocketClientMock: vi.fn(),
    deleteUnattachedHostedEquipmentImageMock: vi.fn<typeof deleteUnattachedHostedEquipmentImage>(),
    getCloudflareImagesBindingMock: vi.fn(),
    getValidatedQueryMock: vi.fn<typeof nuxtServer.getValidatedQuery>(),
    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>(),
    insertContributionValuesMock: vi.fn(),
    setResponseStatusMock: vi.fn<typeof nuxtServer.setResponseStatus>(),
    uploadHostedEquipmentImageMock: vi.fn<typeof uploadHostedEquipmentImage>(),
    validateAdminUserMock: vi.fn(),
    validateEquipmentItemImageRequestMock: vi.fn<() => string>()
  }
})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {
  return {
    getValidatedRouteParams: getValidatedRouteParamsMock
  }
})

vi.mock(import('nuxt/server'), async () => {
  const actual = await vi.importActual<typeof nuxtServer>('nuxt/server')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof nuxtServer.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof nuxtServer.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return {
    getCloudflareImagesBinding: getCloudflareImagesBindingMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    createRuntimeWebSocketClient: createWebSocketClientMock
  }
})

vi.mock(import('#server/utils/equipment/item-images'), () => {
  return {
    createEquipmentItemImageBody: createEquipmentItemImageBodyMock,
    deleteUnattachedHostedEquipmentImage: deleteUnattachedHostedEquipmentImageMock,
    uploadHostedEquipmentImage: uploadHostedEquipmentImageMock,
    validateEquipmentItemImageRequest: validateEquipmentItemImageRequestMock
  }
})

function createUploadDb() {
  const findItemMock = vi.fn(() => {
    return { id: itemId }
  })

  return {
    query: {
      equipmentItems: {
        findFirst: findItemMock
      }
    }
  }
}

function createWriteDb(options: { insertError?: Error; } = {}) {
  const lockedItemFromMock = vi.fn(() => {
    return {
      where: vi.fn(() => {
        return {
          limit: vi.fn(() => {
            return {
              for: vi.fn(() => [{ id: itemId }])
            }
          })
        }
      })
    }
  })

  const displayOrderFromMock = vi.fn(() => {
    return {
      where: vi.fn(() => [{ displayOrder: 0 }])
    }
  })

  const selectMock = vi.fn()
    .mockReturnValueOnce({ from: lockedItemFromMock })
    .mockReturnValueOnce({ from: displayOrderFromMock })

  const newImage = {
    cloudflareImageId,
    displayOrder: 1,
    id: imageId
  }

  const insertImageValuesMock = vi.fn(() => {
    return {
      returning: vi.fn(() => {
        if (options.insertError !== undefined) {
          throw options.insertError
        }

        return [newImage]
      })
    }
  })

  const insertMock = vi.fn()
    .mockReturnValueOnce({ values: insertImageValuesMock })
    .mockReturnValueOnce({ values: insertContributionValuesMock })

  const transaction = {
    insert: insertMock,
    select: selectMock
  }

  const transactionMock = vi.fn(async (
    executeTransaction: (value: typeof transaction) => Promise<unknown>
  ) => {
    const result = await executeTransaction(transaction)

    return result
  })

  const endMock = vi.fn()

  return {
    $client: {
      end: endMock
    },

    transaction: transactionMock
  }
}

describe('post /api/equipment/items/[id]/images', () => {
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
    createWebSocketClientMock.mockReturnValue(writeDb)
    getCloudflareImagesBindingMock.mockReturnValue({ binding: 'images' })
    getValidatedQueryMock.mockResolvedValue({ filename })
    getValidatedRouteParamsMock.mockResolvedValue({ id: itemId })
    uploadHostedEquipmentImageMock.mockResolvedValue(cloudflareImageId)
    validateAdminUserMock.mockResolvedValue(userId)
    validateEquipmentItemImageRequestMock.mockReturnValue('image/webp')
  })

  it('should preserve the original filename in Cloudflare Images', async () => {
    const event = createTestEvent(createUploadDb())
    const result = await uploadImageHandler(event)
    const createBodyOptions = createEquipmentItemImageBodyMock.mock.calls[0]?.[0]
    const uploadOptions = uploadHostedEquipmentImageMock.mock.calls[0]?.[0]

    expect(createBodyOptions).toStrictEqual({
      mediaType: 'image/webp',
      stream: undefined
    })

    expect(uploadOptions).toMatchObject({
      binding: { binding: 'images' },
      creator: userId,
      filename,

      metadata: {
        itemId
      },

      requireSignedURLs: false
    })

    expect(uploadOptions?.body).toBeDefined()

    expect(result).toStrictEqual({
      cloudflareImageId,
      displayOrder: 1,
      id: imageId
    })

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
  })

  it('should delete an uploaded asset after a database failure', async () => {
    const databaseError = new Error('database unavailable')
    const writeDb = createWriteDb({ insertError: databaseError })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure telemetry.
    })

    createWebSocketClientMock.mockReturnValue(writeDb)

    await expect(uploadImageHandler(createTestEvent(createUploadDb()))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to save equipment item image'
    })

    expect(deleteUnattachedHostedEquipmentImageMock).toHaveBeenCalledWith({
      binding: { binding: 'images' },
      cloudflareImageId
    })

    expect(writeDb.$client.end).toHaveBeenCalledTimes(1)

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to save equipment item image',
      expect.objectContaining({ error: databaseError })
    )
  })
})
