import {
  createError,
  getRequestHeader,
  type H3Event
} from 'h3'

import { limits } from '#shared/constants'

import {
  createLimitedRequestBody,
  getContentLength,
  validateDeclaredByteLength
} from '#server/utils/equipment/limited-request-body'

const invalidImageErrorCode = 9412

const supportedImageMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

interface EquipmentItemImageBody {
  close: () => Promise<void>;
  isLimitExceeded: () => boolean;
  mediaType: string;
  stream: ReadableStream<Uint8Array>;
}

interface CreateEquipmentItemImageBodyOptions {
  declaredByteLength?: number;
  mediaType: string;
  stream: ReadableStream<unknown> | undefined;
}

interface UploadHostedEquipmentImageOptions {
  binding: Env['IMAGES'];
  body: EquipmentItemImageBody;
  creator: string;
  filename: string;
  metadata: Record<string, unknown>;
  requireSignedURLs: boolean;
}

interface DeleteUnattachedHostedEquipmentImageOptions {
  binding: Env['IMAGES'];
  cloudflareImageId: string;
}

interface InspectHostedEquipmentImageOptions {
  binding: Env['IMAGES'];
  body: EquipmentItemImageBody;
  infoStream: ReadableStream<Uint8Array>;
  metadata: Record<string, unknown>;
  uploadStream: ReadableStream<Uint8Array>;
}

function validateImageMediaType(mediaType: string): string {
  const normalizedMediaType = mediaType.trim().toLowerCase()

  if (supportedImageMediaTypes.has(normalizedMediaType) === false) {
    throw createError({
      status: 415,
      statusMessage: 'Unsupported image content type'
    })
  }

  return normalizedMediaType
}

function validateEquipmentItemImageRequest(event: H3Event): string {
  const contentType = getRequestHeader(event, 'content-type')
  const mediaType = contentType?.split(';', 1)[0] ?? ''
  const normalizedMediaType = validateImageMediaType(mediaType)

  validateDeclaredByteLength(
    getContentLength(event),
    limits.maxEquipmentItemImageByteLength
  )

  return normalizedMediaType
}

async function cancelSourceStream(stream: ReadableStream<unknown> | undefined): Promise<void> {
  if (stream === undefined) {
    return
  }

  try {
    await stream.cancel()
  } catch {
    // Rejecting an invalid source still closes every stream that can be cancelled.
  }
}

async function validateImageBodyOptions(
  options: CreateEquipmentItemImageBodyOptions
): Promise<string> {
  try {
    const mediaType = validateImageMediaType(options.mediaType)

    validateDeclaredByteLength(
      options.declaredByteLength,
      limits.maxEquipmentItemImageByteLength
    )

    return mediaType
  } catch (error) {
    await cancelSourceStream(options.stream)

    throw error
  }
}

async function createEquipmentItemImageBody(
  options: CreateEquipmentItemImageBodyOptions
): Promise<EquipmentItemImageBody> {
  const mediaType = await validateImageBodyOptions(options)

  const body = await createLimitedRequestBody(
    options.stream,
    limits.maxEquipmentItemImageByteLength
  )

  return {
    close: body.close,
    isLimitExceeded: body.isLimitExceeded,
    mediaType,
    stream: body.stream
  }
}

function isInvalidImageError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  return Reflect.get(error, 'code') === invalidImageErrorCode
}

async function cancelUnusedStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  try {
    await stream.cancel()
  } catch {
    // A binding may already have consumed or locked this branch.
  }
}

async function inspectHostedEquipmentImage(
  options: InspectHostedEquipmentImageOptions
): Promise<ImageInfoResponse> {
  const {
    binding,
    body,
    infoStream,
    metadata,
    uploadStream
  } = options

  try {
    return await binding.info(infoStream)
  } catch (error) {
    void cancelUnusedStream(infoStream)
    void cancelUnusedStream(uploadStream)

    if (body.isLimitExceeded()) {
      throw createError({
        status: 413,
        statusMessage: 'Image body is too large'
      })
    }

    if (isInvalidImageError(error)) {
      throw createError({
        status: 415,
        statusMessage: 'Unsupported image format'
      })
    }

    console.error('Failed to inspect Cloudflare image', {
      error,
      metadata
    })

    throw createError({
      status: 502,
      statusMessage: 'Image inspection failed'
    })
  }
}

async function uploadHostedEquipmentImage(
  options: UploadHostedEquipmentImageOptions
): Promise<string> {
  const {
    binding,
    body,
    creator,
    filename,
    metadata,
    requireSignedURLs
  } = options
  const [infoStream, uploadStream] = body.stream.tee()

  try {
    const imageInfo = await inspectHostedEquipmentImage({
      binding,
      body,
      infoStream,
      metadata,
      uploadStream
    })

    const isSupportedFormat = supportedImageMediaTypes.has(imageInfo.format)
    const doesMediaTypeMatch = imageInfo.format === body.mediaType

    if (isSupportedFormat === false || doesMediaTypeMatch === false) {
      void cancelUnusedStream(uploadStream)

      throw createError({
        status: 415,
        statusMessage: 'Unsupported image format'
      })
    }

    try {
      const image = await binding.hosted.upload(uploadStream, {
        creator,
        filename,
        metadata,
        requireSignedURLs
      })

      return image.id
    } catch (error) {
      if (body.isLimitExceeded()) {
        throw createError({
          status: 413,
          statusMessage: 'Image body is too large'
        })
      }

      console.error('Failed to upload Cloudflare image', {
        error,
        metadata
      })

      throw createError({
        status: 502,
        statusMessage: 'Image upload failed'
      })
    }
  } finally {
    await body.close()
  }
}

async function deleteUnattachedHostedEquipmentImage(
  options: DeleteUnattachedHostedEquipmentImageOptions
): Promise<void> {
  const { binding, cloudflareImageId } = options

  try {
    const imageHandle = binding.hosted.image(cloudflareImageId)

    await imageHandle.delete()
  } catch (error) {
    console.error('Failed to delete unattached Cloudflare image', {
      cloudflareImageId,
      error
    })
  }
}

export {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage,
  validateEquipmentItemImageRequest
}

export type {
  EquipmentItemImageBody
}
