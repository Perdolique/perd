import { createError, getRequestHeader, type H3Event } from 'h3'

interface LimitedRequestBody {
  close: () => Promise<void>;
  isLimitExceeded: () => boolean;
  stream: ReadableStream<Uint8Array>;
}

function getBodyChunk(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }

  throw createError({
    status: 400,
    statusMessage: 'Request body must be binary'
  })
}

function getContentLength(event: H3Event): number | undefined {
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

  return Number(contentLengthHeader)
}

function validateDeclaredByteLength(
  declaredByteLength: number | undefined,
  maximumByteLength: number
): void {
  if (declaredByteLength === undefined) {
    return
  }

  if (declaredByteLength === 0) {
    throw createError({
      status: 400,
      statusMessage: 'Request body is required'
    })
  }

  if (declaredByteLength > maximumByteLength) {
    throw createError({
      status: 413,
      statusMessage: 'Image body is too large'
    })
  }
}

async function createLimitedRequestBody(
  sourceStream: ReadableStream<unknown> | undefined,
  maximumByteLength: number
): Promise<LimitedRequestBody> {
  if (sourceStream === undefined) {
    throw createError({
      status: 400,
      statusMessage: 'Request body is required'
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
      await reader.cancel()
    } catch {
      // Closing a failed or already-cancelled request body is idempotent.
    }

    releaseReader()
  }

  async function readFirstResult(): Promise<ReadableStreamReadResult<unknown>> {
    try {
      return await reader.read()
    } catch (error) {
      await closeReader()

      throw error
    }
  }

  let firstResult = await readFirstResult()
  let initialChunk: Uint8Array | null = null

  try {
    while (firstResult.done === false) {
      const chunk = getBodyChunk(firstResult.value)

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
      statusMessage: 'Request body is required'
    })
  }

  let { byteLength } = initialChunk

  if (byteLength > maximumByteLength) {
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

        const chunk = getBodyChunk(result.value)

        byteLength += chunk.byteLength

        if (byteLength > maximumByteLength) {
          isLimitExceeded = true
          await closeReader()
          controller.error(new Error('Request body is too large'))

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
  createLimitedRequestBody,
  getContentLength,
  validateDeclaredByteLength
}

export type {
  LimitedRequestBody
}
