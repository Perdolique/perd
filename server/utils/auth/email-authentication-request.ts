import { getRequestMetadataHeader, getRequestBodyStream } from '#server/utils/request-runtime'
import { createError, isNuxtError, type RequestEvent } from 'nuxt/server'
import { getAuthErrorDetails } from './telemetry'

type EmailAuthenticationBodyValidator<Body> = (
  value: unknown
) => Body | false | Promise<Body | false>

interface EmailAuthenticationRateLimitOptions {
  deniedStatusMessage: string;
  getBinding: () => RateLimit;
  keys: readonly string[];
  logMessage: string;
  unavailableStatusMessage: string;
}

function validateEmailAuthenticationRequest(event: RequestEvent, expectedOrigin: string): void {
  const contentType = getRequestMetadataHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase()

  if (contentType !== 'application/json') {
    throw createError({
      status: 415,
      statusText: 'JSON is required'
    })
  }

  const origin = getRequestMetadataHeader(event, 'origin')
  const fetchSite = getRequestMetadataHeader(event, 'sec-fetch-site')

  if (origin !== expectedOrigin || fetchSite === 'cross-site') {
    throw createError({
      status: 403,
      statusText: 'Request origin is not allowed'
    })
  }
}

function getDeclaredBodyByteLength(event: RequestEvent): number | undefined {
  const contentLength = getRequestMetadataHeader(event, 'content-length')

  if (contentLength === undefined) {
    return
  }

  if (/^\d+$/u.test(contentLength) === false) {
    throw createError({
      status: 400,
      statusText: 'Invalid Content-Length'
    })
  }

  return Number(contentLength)
}

async function readLimitedJsonText(
  stream: ReadableStream<unknown> | undefined,
  maximumByteLength: number
): Promise<string> {
  if (stream === undefined) {
    throw createError({
      status: 400,
      statusText: 'Request body is required'
    })
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let byteLength = 0
  let text = ''

  try {
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- The request stream must be consumed in order.
      const result = await reader.read()

      if (result.done) {
        text += decoder.decode()

        return text
      }

      if ((result.value instanceof Uint8Array) === false) {
        throw createError({
          status: 400,
          statusText: 'Request body must be binary'
        })
      }

      byteLength += result.value.byteLength

      if (byteLength > maximumByteLength) {
        throw createError({
          status: 413,
          statusText: 'Request body is too large'
        })
      }

      text += decoder.decode(result.value, { stream: true })
    }
  } catch (error) {
    try {
      await reader.cancel()
    } catch {
      // Cancelling a failed request body is best-effort cleanup.
    }

    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      cause: error,
      status: 400,
      statusText: 'Invalid JSON body'
    })
  } finally {
    reader.releaseLock()
  }
}

function parseJsonBody(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText)
  } catch (error) {
    throw createError({
      cause: error,
      status: 400,
      statusText: 'Invalid JSON body'
    })
  }
}

async function validateJsonBody<Body>(
  value: unknown,
  validate: EmailAuthenticationBodyValidator<Body>
): Promise<Body> {
  try {
    const validated = await validate(value)

    if (validated === false) {
      throw createError({
        status: 400,
        statusText: 'Request body is invalid'
      })
    }

    return validated
  } catch (error) {
    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      cause: error,
      status: 400,
      statusText: 'Request body is invalid'
    })
  }
}

async function readLimitedValidatedJsonBody<Body>(
  event: RequestEvent,
  maximumByteLength: number,
  validate: EmailAuthenticationBodyValidator<Body>
): Promise<Body> {
  const declaredByteLength = getDeclaredBodyByteLength(event)

  if (declaredByteLength !== undefined && declaredByteLength > maximumByteLength) {
    throw createError({
      status: 413,
      statusText: 'Request body is too large'
    })
  }

  const jsonText = await readLimitedJsonText(getRequestBodyStream(event), maximumByteLength)
  const value = parseJsonBody(jsonText)

  return validateJsonBody(value, validate)
}

async function enforceEmailAuthenticationRateLimit(
  event: RequestEvent,
  options: EmailAuthenticationRateLimitOptions
): Promise<void> {
  const {
    deniedStatusMessage,
    getBinding,
    keys,
    logMessage,
    unavailableStatusMessage
  } = options

  let isDenied = false

  try {
    const binding = getBinding()

    for (const key of keys) {
      // oxlint-disable-next-line no-await-in-loop -- A denied broad key must short-circuit narrower quota use.
      const outcome = await binding.limit({ key })

      if (outcome.success === false) {
        isDenied = true

        break
      }
    }
  } catch (error) {
    const details = getAuthErrorDetails(error, keys)

    console.error(logMessage, { error: details })

    throw createError({
      cause: details,
      status: 503,
      statusText: unavailableStatusMessage
    })
  }

  if (isDenied) {
    event.res.headers.set('Retry-After', '60')

    throw createError({
      status: 429,
      statusText: deniedStatusMessage
    })
  }
}

export {
  enforceEmailAuthenticationRateLimit,
  readLimitedValidatedJsonBody,
  validateEmailAuthenticationRequest
}
