import { createError, getRequestHeader, type H3Event } from 'h3'
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

function getPromiseRejectionReason(result: PromiseSettledResult<unknown>): unknown {
  return result.status === 'rejected' ? result.reason as unknown : undefined
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
    const imageInfoPromise = binding.info(infoStream)

    const imageUploadPromise = binding.hosted.upload(uploadStream, {
      creator,
      filename,
      metadata,
      requireSignedURLs
    })

    const [imageInfoResult, imageUploadResult] = await Promise.allSettled([
      imageInfoPromise,
      imageUploadPromise
    ])

    const uploadedImageId = imageUploadResult.status === 'fulfilled'
      ? imageUploadResult.value.id
      : null

    const imageInfoError = getPromiseRejectionReason(imageInfoResult)
    const imageUploadError = getPromiseRejectionReason(imageUploadResult)

    if (body.isLimitExceeded()) {
      if (uploadedImageId !== null) {
        await deleteUnattachedHostedEquipmentImage({
          binding,
          cloudflareImageId: uploadedImageId
        })
      }

      throw createError({
        status: 413,
        statusMessage: 'Image body is too large'
      })
    }

    if (imageInfoResult.status === 'rejected') {
      if (uploadedImageId !== null) {
        await deleteUnattachedHostedEquipmentImage({
          binding,
          cloudflareImageId: uploadedImageId
        })
      }

      if (isInvalidImageError(imageInfoError)) {
        throw createError({
          status: 415,
          statusMessage: 'Unsupported image format'
        })
      }

      console.error('Failed to inspect Cloudflare image', {
        error: imageInfoError,
        metadata,
        uploadError: imageUploadError
      })

      throw createError({
        status: 502,
        statusMessage: 'Image inspection failed'
      })
    }

    const imageInfo = imageInfoResult.value
    const isSupportedFormat = supportedImageMediaTypes.has(imageInfo.format)
    const doesMediaTypeMatch = imageInfo.format === body.mediaType

    if (isSupportedFormat === false || doesMediaTypeMatch === false) {
      if (uploadedImageId !== null) {
        await deleteUnattachedHostedEquipmentImage({
          binding,
          cloudflareImageId: uploadedImageId
        })
      }

      throw createError({
        status: 415,
        statusMessage: 'Unsupported image format'
      })
    }

    if (imageUploadResult.status === 'rejected') {
      console.error('Failed to upload Cloudflare image', {
        error: imageUploadError,
        metadata
      })

      throw createError({
        status: 502,
        statusMessage: 'Image upload failed'
      })
    }

    return imageUploadResult.value.id
  } finally {
    await body.close()
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
