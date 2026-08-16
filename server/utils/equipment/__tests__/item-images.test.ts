import { afterEach, describe, expect, it, vi } from 'vitest'
import { limits } from '#shared/constants'

import {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage,
  type EquipmentItemImageBody
} from '#server/utils/equipment/item-images'

import {
  readLimitedMultipartFormData,
  validatePhotoSubmissionMultipartRequest
} from '#server/utils/equipment/photo-submission-form'

import { createTestEvent } from '~~/test-utils/create-test-event'

function createImagesBinding(options: {
  deleteImageError?: Error;
  imageInfo?: ImageInfoResponse;
  imageInfoError?: Error;
  uploadImageError?: Error;
} = {}) {
  const imageMetadata: ImageMetadata = {
    id: 'cloudflare-image-1',
    requireSignedURLs: false,
    variants: []
  }

  const deleteImageMock = vi.fn<() => Promise<boolean>>()
  const imageInfoMock = vi.fn<Env['IMAGES']['info']>()

  const defaultImageInfo: ImageInfoResponse = {
    fileSize: 4,
    format: 'image/webp',
    height: 1,
    width: 1
  }

  const uploadImageMock = vi.fn<Env['IMAGES']['hosted']['upload']>()

  if (options.deleteImageError === undefined) {
    deleteImageMock.mockResolvedValue(true)
  } else {
    deleteImageMock.mockRejectedValue(options.deleteImageError)
  }

  if (options.imageInfoError === undefined) {
    imageInfoMock.mockResolvedValue(options.imageInfo ?? defaultImageInfo)
  } else {
    imageInfoMock.mockRejectedValue(options.imageInfoError)
  }

  if (options.uploadImageError === undefined) {
    uploadImageMock.mockResolvedValue(imageMetadata)
  } else {
    uploadImageMock.mockRejectedValue(options.uploadImageError)
  }

  const imageHandle: ImageHandle = {
    bytes: vi.fn<ImageHandle['bytes']>().mockResolvedValue(null),
    delete: deleteImageMock,
    details: vi.fn<ImageHandle['details']>().mockResolvedValue(imageMetadata),
    update: vi.fn<ImageHandle['update']>().mockResolvedValue(imageMetadata)
  }

  const imageMock = vi.fn<Env['IMAGES']['hosted']['image']>(() => imageHandle)

  const binding: Env['IMAGES'] = {
    hosted: {
      image: imageMock,
      list: vi.fn<Env['IMAGES']['hosted']['list']>().mockResolvedValue({
        images: [],
        listComplete: true
      }),
      upload: uploadImageMock
    },
    info: imageInfoMock,
    input: vi.fn<Env['IMAGES']['input']>()
  }

  return {
    binding,
    deleteImageMock,
    imageInfoMock,
    imageMock,
    uploadImageMock
  }
}

function createImageBody(options: {
  close?: () => Promise<void>;
  isLimitExceeded?: () => boolean;
  mediaType?: string;
  stream?: ReadableStream<Uint8Array>;
} = {}): EquipmentItemImageBody {
  return {
    close: options.close ?? vi.fn<() => Promise<void>>().mockResolvedValue(),
    isLimitExceeded: options.isLimitExceeded ?? (() => false),
    mediaType: options.mediaType ?? 'image/webp',
    stream: options.stream ?? new ReadableStream<Uint8Array>()
  }
}

async function createMultipartEvent(formData: FormData) {
  const request = new Request('http://localhost/photo-submissions', {
    body: formData,
    method: 'POST'
  })

  const body = new Uint8Array(await request.arrayBuffer())
  const event = createTestEvent({})

  event.node.req.method = 'POST'
  event.node.req.headers['content-length'] = String(body.byteLength)
  event.node.req.headers['content-type'] = request.headers.get('content-type') ?? ''
  event.node.req.push(body)
  // oxlint-disable-next-line unicorn/prefer-single-call -- Node streams accept one chunk per push call.
  event.node.req.push(null)

  return event
}

function getFormDataFile(formData: FormData, name: string): File {
  const value = formData.get(name)

  if ((value instanceof File) === false) {
    throw new TypeError(`Expected ${name} to be a File`)
  }

  return value
}

describe('equipment item image lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should inspect the real format before uploading with the requested visibility', async () => {
    const { binding, imageInfoMock, uploadImageMock } = createImagesBinding()
    const closeMock = vi.fn<() => Promise<void>>().mockResolvedValue()

    const body = createImageBody({
      close: closeMock,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]))
          controller.close()
        }
      })
    })

    const result = await uploadHostedEquipmentImage({
      binding,
      body,
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: true
    })

    expect(imageInfoMock).toHaveBeenCalledWith(expect.any(ReadableStream))
    expect(uploadImageMock).toHaveBeenCalledWith(expect.any(ReadableStream), {
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: true
    })
    expect(result).toBe('cloudflare-image-1')
    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(Math.max(...imageInfoMock.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...uploadImageMock.mock.invocationCallOrder)
    )
  })

  it('should reject a declared and detected MIME mismatch and cancel the upload branch', async () => {
    const infoStream = new ReadableStream<Uint8Array>()
    const uploadStream = new ReadableStream<Uint8Array>()
    const uploadBranchCancelMock = vi.spyOn(uploadStream, 'cancel').mockResolvedValue()
    const bodyStream = new ReadableStream<Uint8Array>()

    vi.spyOn(bodyStream, 'tee').mockReturnValue([infoStream, uploadStream])

    const body = createImageBody({ stream: bodyStream })

    const { binding, uploadImageMock } = createImagesBinding({
      imageInfo: {
        fileSize: 4,
        format: 'image/png',
        height: 1,
        width: 1
      }
    })

    await expect(uploadHostedEquipmentImage({
      binding,
      body,
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: false
    })).rejects.toMatchObject({
      statusCode: 415
    })
    expect(uploadBranchCancelMock).toHaveBeenCalledTimes(1)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('should map invalid image bytes to 415 without uploading', async () => {
    const invalidImageError = Object.assign(new Error('not an image'), { code: 9412 })

    const { binding, uploadImageMock } = createImagesBinding({
      imageInfoError: invalidImageError
    })

    await expect(uploadHostedEquipmentImage({
      binding,
      body: createImageBody(),
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: false
    })).rejects.toMatchObject({
      statusCode: 415
    })
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('should map other Images binding inspection failures to a safe 502', async () => {
    const inspectionError = new Error('binding unavailable')

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected binding failure telemetry.
    })

    const { binding } = createImagesBinding({
      imageInfoError: inspectionError
    })

    await expect(uploadHostedEquipmentImage({
      binding,
      body: createImageBody(),
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: false
    })).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Image inspection failed'
    })
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to inspect Cloudflare image',
      expect.objectContaining({ error: inspectionError })
    )
  })

  it('should map hosted upload failures to a safe 502 and close the body', async () => {
    const uploadError = new Error('hosted upload unavailable')

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected binding failure telemetry.
    })

    const closeMock = vi.fn<() => Promise<void>>().mockResolvedValue()
    const { binding } = createImagesBinding({ uploadImageError: uploadError })

    await expect(uploadHostedEquipmentImage({
      binding,
      body: createImageBody({ close: closeMock }),
      creator: 'user-1',
      filename: 'photo.webp',
      metadata: { itemId: 'item-1' },
      requireSignedURLs: false
    })).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Image upload failed'
    })
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to upload Cloudflare image',
      expect.objectContaining({ error: uploadError })
    )
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    'image/gif',
    'image/heic',
    'image/svg+xml'
  ])('should reject unsupported declared media type %s before reading it', async (mediaType) => {
    const cancelMock = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel: cancelMock })

    await expect(createEquipmentItemImageBody({
      declaredByteLength: 10,
      mediaType,
      stream
    })).rejects.toMatchObject({
      statusCode: 415
    })
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  it('should cancel an oversized declared image stream before reading it', async () => {
    const cancelMock = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel: cancelMock })

    await expect(createEquipmentItemImageBody({
      declaredByteLength: limits.maxEquipmentItemImageByteLength + 1,
      mediaType: 'image/webp',
      stream
    })).rejects.toMatchObject({
      statusCode: 413
    })
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  it('should preserve the original error when unattached asset deletion fails', async () => {
    const deletionError = new Error('delete unavailable')

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected cleanup failure telemetry.
    })

    const { binding } = createImagesBinding({
      deleteImageError: deletionError
    })

    await expect(deleteUnattachedHostedEquipmentImage({
      binding,
      cloudflareImageId: 'cloudflare-image-1'
    })).resolves.toBeUndefined()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to delete unattached Cloudflare image',
      {
        cloudflareImageId: 'cloudflare-image-1',
        error: deletionError
      }
    )
  })
})

describe('photo submission multipart parsing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should parse form fields and preserve the uploaded file metadata', async () => {
    const formData = new FormData()

    formData.append('photo', new File(['valid-webp'], 'photo.webp', { type: 'image/webp' }))
    formData.append('rightsConfirmed', 'true')
    formData.append('sourceType', 'own')

    const event = await createMultipartEvent(formData)
    const contentType = validatePhotoSubmissionMultipartRequest(event)
    const parsedFormData = await readLimitedMultipartFormData(event, contentType)
    const photo = getFormDataFile(parsedFormData, 'photo')

    expect(parsedFormData.get('rightsConfirmed')).toBe('true')
    expect(parsedFormData.get('sourceType')).toBe('own')
    expect(photo.name).toBe('photo.webp')
    expect(photo.type).toBe('image/webp')
    expect(photo.size).toBe(10)
  })

  it('should reject an oversized multipart request before reading the body', () => {
    const event = createTestEvent({})

    event.node.req.method = 'POST'
    event.node.req.headers['content-length'] = '5500001'
    event.node.req.headers['content-type'] = 'multipart/form-data; boundary=test-boundary'

    expect(() => validatePhotoSubmissionMultipartRequest(event)).toThrow(
      expect.objectContaining({ statusCode: 413 })
    )
  })
})
