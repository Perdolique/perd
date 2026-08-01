import {
  createError,
  getRequestHeader,
  getRequestWebStream,
  type H3Event
} from 'h3'

const maximumImageByteLength = 5_000_000

const supportedImageMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

interface EquipmentItemImageBody {
  close: () => Promise<void>;
  isLimitExceeded: () => boolean;
  stream: ReadableStream<Uint8Array>;
}

function getImageChunk(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }

  throw createError({
    status: 400,
    statusMessage: 'Image body must be binary'
  })
}

function validateImageContentType(event: H3Event): void {
  const contentType = getRequestHeader(event, 'content-type')
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()

  if (mediaType === undefined || supportedImageMediaTypes.has(mediaType) === false) {
    throw createError({
      status: 415,
      statusMessage: 'Unsupported image content type'
    })
  }
}

function validateImageContentLength(event: H3Event): void {
  const contentLengthHeader = getRequestHeader(event, 'content-length')

  if (contentLengthHeader === undefined) {
    return
  }

  const hasValidContentLength = /^\d+$/u.test(contentLengthHeader)

  if (hasValidContentLength === false) {
    throw createError({
      status: 400,
      statusMessage: 'Invalid Content-Length'
    })
  }

  const contentLength = Number(contentLengthHeader)

  if (contentLength === 0) {
    throw createError({
      status: 400,
      statusMessage: 'Image body is required'
    })
  }

  if (contentLength > maximumImageByteLength) {
    throw createError({
      status: 413,
      statusMessage: 'Image body is too large'
    })
  }
}

function validateEquipmentItemImageRequest(event: H3Event): void {
  validateImageContentType(event)
  validateImageContentLength(event)
}

async function createEquipmentItemImageBody(event: H3Event): Promise<EquipmentItemImageBody> {
  const sourceStream: ReadableStream<unknown> | undefined = getRequestWebStream(event)

  if (sourceStream === undefined) {
    throw createError({
      status: 400,
      statusMessage: 'Image body is required'
    })
  }

  const reader = sourceStream.getReader()
  let isReaderReleased = false

  function releaseReader(): void {
    if (isReaderReleased) {
      return
    }

    isReaderReleased = true
    reader.releaseLock()
  }

  async function closeReader(): Promise<void> {
    if (isReaderReleased) {
      return
    }

    try {
      await reader.cancel().catch(() => null)
    } finally {
      releaseReader()
    }
  }

  let firstResult = await reader.read().catch(async (error: unknown) => {
    await closeReader()

    throw error
  })
  let initialChunk: Uint8Array | null = null

  try {
    while (firstResult.done === false) {
      const chunk = getImageChunk(firstResult.value)

      if (chunk.byteLength > 0) {
        initialChunk = chunk

        break
      }

      // oxlint-disable-next-line no-await-in-loop -- Empty chunks do not make the request body non-empty.
      firstResult = await reader.read()
    }
  } catch (error) {
    await closeReader()

    throw error
  }

  if (initialChunk === null) {
    releaseReader()

    throw createError({
      status: 400,
      statusMessage: 'Image body is required'
    })
  }

  let { byteLength } = initialChunk

  if (byteLength > maximumImageByteLength) {
    await closeReader()

    throw createError({
      status: 413,
      statusMessage: 'Image body is too large'
    })
  }

  let firstChunk: Uint8Array | undefined = initialChunk
  let isLimitExceeded = false

  const stream = new ReadableStream<Uint8Array>({
    cancel: closeReader,

    async pull(controller) {
      try {
        if (firstChunk !== undefined) {
          controller.enqueue(firstChunk)
          firstChunk = undefined

          return
        }

        const result = await reader.read()

        if (result.done) {
          releaseReader()
          controller.close()

          return
        }

        const chunk = getImageChunk(result.value)

        byteLength += chunk.byteLength

        if (byteLength > maximumImageByteLength) {
          isLimitExceeded = true
          await closeReader()
          controller.error(new Error('Image body is too large'))

          return
        }

        controller.enqueue(chunk)
      } catch (error) {
        await closeReader()
        controller.error(error)
      }
    }
  })

  return {
    close: closeReader,
    isLimitExceeded: () => isLimitExceeded,
    stream
  }
}

export {
  createEquipmentItemImageBody,
  validateEquipmentItemImageRequest
}

export type {
  EquipmentItemImageBody
}
