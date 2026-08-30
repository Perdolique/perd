import type * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import imageHandler from '#server/api/equipment/images/[cloudflare-image-id].get.dev'
import { validateEquipmentImageDeliveryParams } from '#server/utils/validation/schemas'
import { createTestEvent } from '~~/test-utils/create-test-event'

const cloudflareImageId = 'public-image'

const {
  getCloudflareImagesBindingMock,
  getValidatedRouterParamsMock
} = vi.hoisted(() => {
  return {
    getCloudflareImagesBindingMock: vi.fn(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    }
  }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return { getCloudflareImagesBinding: getCloudflareImagesBindingMock }
})

function createImageEvent(image?: { id: string; }) {
  const findFirstMock = vi.fn(() => image)

  const event = createTestEvent({
    query: {
      equipmentItemImages: { findFirst: findFirstMock }
    }
  })

  return {
    event,
    findFirstMock
  }
}

describe('local equipment image delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getValidatedRouterParamsMock.mockResolvedValue({
      'cloudflare-image-id': cloudflareImageId
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should stream published image bytes with detected MIME and no-store caching', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const bytesMock = vi.fn(() => new Response(bytes).body)

    const infoMock = vi.fn(async (stream: ReadableStream<Uint8Array>) => {
      await new Response(stream).arrayBuffer()

      return {
        fileSize: bytes.length,
        format: 'image/webp',
        height: 1,
        width: 1
      }
    })

    const imageMock = vi.fn(() => {
      return { bytes: bytesMock }
    })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: imageMock
      },

      info: infoMock
    })

    const { event, findFirstMock } = createImageEvent({ id: 'image-row' })
    const response = await imageHandler(event)

    expect(getValidatedRouterParamsMock).toHaveBeenCalledWith(
      event,
      validateEquipmentImageDeliveryParams
    )

    expect(findFirstMock).toHaveBeenCalledWith({
      columns: {
        id: true
      },

      where: {
        cloudflareImageId
      }
    })

    expect(imageMock).toHaveBeenCalledWith(cloudflareImageId)
    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(bytes)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('should return 404 when the image is not published', async () => {
    const { event } = createImageEvent()

    await expect(imageHandler(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(getCloudflareImagesBindingMock).not.toHaveBeenCalled()
  })

  it('should return 404 when the hosted image bytes are missing', async () => {
    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn(() => {
          return {
            bytes: vi.fn(() => null)
          }
        })
      }
    })

    const { event } = createImageEvent({ id: 'image-row' })

    await expect(imageHandler(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('should log the provider error and return a safe delivery failure', async () => {
    const providerError = new Error('provider secret')

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected provider failure telemetry.
    })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn(() => {
          return {
            bytes: vi.fn(() => new Response(new Uint8Array([1])).body)
          }
        })
      },

      info: vi.fn().mockRejectedValue(providerError)
    })

    const { event } = createImageEvent({ id: 'image-row' })

    await expect(imageHandler(event)).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Equipment image unavailable'
    })

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to load local equipment image',
      {
        cloudflareImageId,
        error: providerError
      }
    )
  })
})
