import type * as h3 from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import uploadImageHandler from '#server/api/equipment/items/[id]/images/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const imageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const cloudflareImageId = 'cloudflare-image-1'
const filename = 'PocketRocket front.webp'

const {
  closeBodyMock,
  createEquipmentItemImageBodyMock,
  createWebSocketClientMock,
  getCloudflareImagesBindingMock,
  getValidatedQueryMock,
  getValidatedRouterParamsMock,
  insertContributionValuesMock,
  setResponseStatusMock,
  uploadCloudflareImageMock,
  validateAdminUserMock,
  validateEquipmentItemImageRequestMock
} = vi.hoisted(() => {
  return {
    closeBodyMock: vi.fn(),
    createEquipmentItemImageBodyMock: vi.fn(),
    createWebSocketClientMock: vi.fn(),
    getCloudflareImagesBindingMock: vi.fn(),
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    insertContributionValuesMock: vi.fn(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    uploadCloudflareImageMock: vi.fn(),
    validateAdminUserMock: vi.fn(),
    validateEquipmentItemImageRequestMock: vi.fn<() => void>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    },

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
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

function createWriteDb() {
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
      returning: vi.fn(() => [newImage])
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
      close: closeBodyMock,
      isLimitExceeded: () => false,
      stream: new ReadableStream<Uint8Array>()
    }
    const writeDb = createWriteDb()

    createEquipmentItemImageBodyMock.mockResolvedValue(body)
    createWebSocketClientMock.mockReturnValue(writeDb)
    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        upload: uploadCloudflareImageMock
      }
    })
    getValidatedQueryMock.mockResolvedValue({ filename })
    getValidatedRouterParamsMock.mockResolvedValue({ id: itemId })
    uploadCloudflareImageMock.mockResolvedValue({ id: cloudflareImageId })
    validateAdminUserMock.mockResolvedValue(userId)
  })

  it('should preserve the original filename in Cloudflare Images', async () => {
    const event = createTestEvent(createUploadDb())
    const result = await uploadImageHandler(event)

    expect(uploadCloudflareImageMock).toHaveBeenCalledWith(expect.any(ReadableStream), {
      creator: userId,
      filename,

      metadata: {
        itemId
      },

      requireSignedURLs: false
    })
    expect(result).toStrictEqual({
      cloudflareImageId,
      displayOrder: 1,
      id: imageId
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(closeBodyMock).toHaveBeenCalledTimes(1)
  })
})
