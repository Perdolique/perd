import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import deleteImageHandler from '#server/api/equipment/items/[id]/images/[image-id].delete'
import { createTestEvent } from '~~/test-utils/create-test-event'

interface EquipmentItemImageRow {
  cloudflareImageId: string;
  displayOrder: number;
  id: string;
}

interface MockDeleteTransaction {
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: {
    equipmentItemImages: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface MockWriteDb {
  $client: {
    end: ReturnType<typeof vi.fn>;
  };
  transaction: ReturnType<typeof vi.fn>;
}

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const imageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'

const image: EquipmentItemImageRow = {
  cloudflareImageId: 'cloudflare-image-1',
  displayOrder: 1,
  id: imageId
}

const waitUntilMock = vi.fn<(promise: Promise<unknown>) => void>()

const {
  createWebSocketClientMock,
  deleteCloudflareImageMock,
  getCloudflareImageMock,
  getCloudflareImagesBindingMock,
  getValidatedRouterParamsMock,
  setResponseStatusMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    createWebSocketClientMock: vi.fn<(event: unknown) => MockWriteDb>(() => {
      throw new Error('createWebSocketClient mock is not configured')
    }),

    deleteCloudflareImageMock: vi.fn<() => Promise<boolean>>(),
    getCloudflareImageMock: vi.fn(),
    getCloudflareImagesBindingMock: vi.fn(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    validateAdminUserMock: vi.fn()
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

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial config mock.
vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: createWebSocketClientMock
  }
})

function createDeleteDb({
  currentImage = image,
  hasImage = true,
  hasItem = true
}: {
  currentImage?: EquipmentItemImageRow;
  hasImage?: boolean;
  hasItem?: boolean;
} = {}) {
  const itemRows = hasItem ? [{ id: itemId }] : []
  const foundImages = hasImage ? [currentImage] : []
  const selectForUpdateMock = vi.fn(() => itemRows)
  const selectLimitMock = vi.fn(() => {
    return { for: selectForUpdateMock }
  })

  const selectWhereMock = vi.fn(() => {
    return { limit: selectLimitMock }
  })

  const selectFromMock = vi.fn(() => {
    return { where: selectWhereMock }
  })

  const selectMock = vi.fn(() => {
    return { from: selectFromMock }
  })

  const findManyMock = vi.fn<() => EquipmentItemImageRow[]>(() => foundImages)
  const deleteReturningMock = vi.fn(() => [{ id: currentImage.id }])
  const deleteWhereMock = vi.fn(() => {
    return { returning: deleteReturningMock }
  })

  const deleteMock = vi.fn(() => {
    return { where: deleteWhereMock }
  })

  const updateWhereMock = vi.fn()
  const updateSetMock = vi.fn(() => {
    return { where: updateWhereMock }
  })

  const updateMock = vi.fn(() => {
    return { set: updateSetMock }
  })

  const insertContributionValuesMock = vi.fn()
  const insertMock = vi.fn(() => {
    return { values: insertContributionValuesMock }
  })

  const transaction: MockDeleteTransaction = {
    delete: deleteMock,
    insert: insertMock,

    query: {
      equipmentItemImages: {
        findMany: findManyMock
      }
    },

    select: selectMock,
    update: updateMock
  }

  const transactionCommitMock = vi.fn()

  const transactionMock = vi.fn(async (
    executeTransaction: (db: MockDeleteTransaction) => Promise<unknown>
  ) => {
    const result = await executeTransaction(transaction)

    transactionCommitMock()

    return result
  })

  const endMock = vi.fn()
  const dbWrite: MockWriteDb = {
    $client: {
      end: endMock
    },

    transaction: transactionMock
  }

  return {
    dbWrite,
    deleteWhereMock,
    findManyMock,
    insertContributionValuesMock,
    transactionCommitMock,
    updateSetMock
  }
}

function createDeleteEvent() {
  const event = createTestEvent({})

  Object.assign(event, {
    waitUntil: waitUntilMock
  })

  return event
}

async function waitForBackgroundTasks() : Promise<void> {
  const backgroundPromises: Promise<unknown>[] = []

  for (const [promise] of waitUntilMock.mock.calls) {
    backgroundPromises.push(promise)
  }

  await Promise.all(backgroundPromises)
}

describe('delete /api/equipment/items/[id]/images/[image-id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    validateAdminUserMock.mockResolvedValue('user-1')

    getValidatedRouterParamsMock.mockResolvedValue({
      id: itemId,
      'image-id': imageId
    })

    getCloudflareImageMock.mockReturnValue({
      delete: deleteCloudflareImageMock
    })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: getCloudflareImageMock
      }
    })

    deleteCloudflareImageMock.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should commit the database deletion before scheduling Cloudflare cleanup', async () => {
    const {
      dbWrite,
      deleteWhereMock,
      findManyMock,
      insertContributionValuesMock,
      transactionCommitMock,
      updateSetMock
    } = createDeleteDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)
    getCloudflareImageMock.mockImplementation(() => {
      expect(transactionCommitMock).toHaveBeenCalledTimes(1)

      return {
        delete: deleteCloudflareImageMock
      }
    })

    const event = createDeleteEvent()

    await deleteImageHandler(event)

    await waitForBackgroundTasks()

    expect(findManyMock).toHaveBeenCalledWith({
      columns: {
        cloudflareImageId: true,
        displayOrder: true,
        id: true
      },

      where: {
        itemId
      },

      orderBy: {
        displayOrder: 'asc'
      }
    })

    expect(getCloudflareImageMock).toHaveBeenCalledWith(image.cloudflareImageId)
    expect(deleteCloudflareImageMock).toHaveBeenCalledTimes(1)
    expect(waitUntilMock).toHaveBeenCalledTimes(1)
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
    expect(updateSetMock).toHaveBeenCalledTimes(2)

    expect(insertContributionValuesMock).toHaveBeenCalledWith({
      action: 'delete_item_image',

      metadata: {
        cloudflareImageId: image.cloudflareImageId,
        displayOrder: image.displayOrder,
        itemId
      },

      targetId: imageId,
      userId: 'user-1'
    })

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should remove the database row when the Cloudflare image is already absent', async () => {
    const { dbWrite, deleteWhereMock } = createDeleteDb()

    createWebSocketClientMock.mockReturnValue(dbWrite)
    deleteCloudflareImageMock.mockResolvedValue(false)

    const event = createDeleteEvent()

    await deleteImageHandler(event)

    await waitForBackgroundTasks()

    expect(deleteCloudflareImageMock).toHaveBeenCalledTimes(1)
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
    expect(waitUntilMock).toHaveBeenCalledTimes(1)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
  })

  it('should return before the background deletion settles', async () => {
    const { dbWrite } = createDeleteDb()
    const deferredDeletion = Promise.withResolvers<boolean>()

    createWebSocketClientMock.mockReturnValue(dbWrite)
    deleteCloudflareImageMock.mockReturnValue(deferredDeletion.promise)

    const event = createDeleteEvent()
    const handlerPromise = deleteImageHandler(event)

    const responseAssertion = vi.waitFor(() => {
      expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
    }, {
      timeout: 100
    })

    const [responseResult] = await Promise.allSettled([responseAssertion])

    deferredDeletion.resolve(true)

    await handlerPromise
    await waitForBackgroundTasks()

    expect(responseResult).toMatchObject({
      status: 'fulfilled'
    })
  })

  it('should return success and log the raw error when background deletion fails', async () => {
    const { dbWrite, transactionCommitMock } = createDeleteDb()
    const cloudflareError = new Error('Cloudflare unavailable')

    createWebSocketClientMock.mockReturnValue(dbWrite)
    deleteCloudflareImageMock.mockRejectedValue(cloudflareError)
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation((message) => {
      expect(message).toBe('Failed to delete Cloudflare image')
    })

    const event = createDeleteEvent()

    await deleteImageHandler(event)

    await waitForBackgroundTasks()

    expect(transactionCommitMock).toHaveBeenCalledTimes(1)
    expect(waitUntilMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorMock).toHaveBeenCalledWith('Failed to delete Cloudflare image', {
      cloudflareImageId: image.cloudflareImageId,
      error: cloudflareError,
      imageId,
      itemId
    })

    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
  })

  it('should return 404 when the image does not belong to the item', async () => {
    const { dbWrite } = createDeleteDb({
      hasImage: false
    })

    createWebSocketClientMock.mockReturnValue(dbWrite)

    const event = createDeleteEvent()

    await expect(deleteImageHandler(event)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Equipment image not found'
    })

    expect(deleteCloudflareImageMock).not.toHaveBeenCalled()
    expect(waitUntilMock).not.toHaveBeenCalled()
    expect(dbWrite.$client.end).toHaveBeenCalledTimes(1)
  })

  it('should reject unauthenticated deletion before accessing Cloudflare or the database', async () => {
    const authError = h3.createError({ status: 401 })

    validateAdminUserMock.mockRejectedValue(authError)

    const event = createDeleteEvent()

    await expect(deleteImageHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })

    expect(getCloudflareImagesBindingMock).not.toHaveBeenCalled()
    expect(createWebSocketClientMock).not.toHaveBeenCalled()
    expect(waitUntilMock).not.toHaveBeenCalled()
  })
})
