import { createError, type H3Event } from 'h3'
import * as v from 'valibot'
import { guestSessionTurnstileAction } from '#shared/utils/turnstile'
import { getRuntimeTurnstileConfig } from '#server/utils/config'

interface TurnstileTelemetryResponse {
  readonly action?: string;
  readonly errorCodes: readonly string[];
  readonly hostname?: string;
  readonly success: boolean;
}

interface TurnstileTelemetryError {
  readonly message: string;
  readonly name: string;
  readonly stack?: string;
}

interface TurnstileTelemetryParseError {
  readonly name: string;
}

interface TurnstileTelemetryIssue {
  readonly kind: string;
  readonly path: readonly string[];
  readonly type: string;
}

const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const maximumTurnstileTokenLength = 2048
const siteverifyTimeoutMilliseconds = 10_000
const telemetryRedaction = '[REDACTED]'

const siteverifyResponseSchema = v.object({
  action: v.optional(v.string()),
  'error-codes': v.optional(v.array(v.string())),
  hostname: v.optional(v.string()),
  success: v.boolean()
})

const serviceErrorCodes = new Set([
  'bad-request',
  'internal-error',
  'invalid-input-secret',
  'missing-input-secret'
])

function createTurnstileServiceError(cause?: unknown) {
  return createError({
    cause,
    status: 503,
    statusMessage: 'Turnstile verification unavailable'
  })
}

function createTurnstileRejection(cause?: unknown) {
  return createError({
    cause,
    status: 403,
    statusMessage: 'Turnstile verification failed'
  })
}

function getTelemetryResponse(result: v.InferOutput<typeof siteverifyResponseSchema>): TurnstileTelemetryResponse {
  const {
    action,
    hostname,
    success
  } = result

  return {
    action,
    errorCodes: result['error-codes'] ?? [],
    hostname,
    success
  }
}

function hasServiceError(errorCodes: readonly string[]): boolean {
  return errorCodes.some(errorCode => serviceErrorCodes.has(errorCode))
}

function redactSensitiveText(value: string, sensitiveValues: readonly string[]): string {
  let redactedValue = value

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue !== '') {
      redactedValue = redactedValue.replaceAll(sensitiveValue, telemetryRedaction)
    }
  }

  return redactedValue
}

function getTelemetryError(
  error: unknown,
  sensitiveValues: readonly string[]
): TurnstileTelemetryError {
  if (error instanceof Error) {
    const stack = error.stack === undefined
      ? undefined
      : redactSensitiveText(error.stack, sensitiveValues)

    return {
      message: redactSensitiveText(error.message, sensitiveValues),
      name: redactSensitiveText(error.name, sensitiveValues),
      stack
    }
  }

  return {
    message: redactSensitiveText(String(error), sensitiveValues),
    name: 'UnknownError'
  }
}

function getTelemetryIssues(
  issues: readonly v.BaseIssue<unknown>[]
): readonly TurnstileTelemetryIssue[] {
  return issues.map((issue) => {
    return {
      kind: issue.kind,
      path: issue.path?.map(pathItem => String(pathItem.key)) ?? [],
      type: issue.type
    }
  })
}

async function requestSiteverify(
  body: URLSearchParams,
  sensitiveValues: readonly string[]
): Promise<Response> {
  const signal = AbortSignal.timeout(siteverifyTimeoutMilliseconds)

  try {
    return await fetch(siteverifyUrl, {
      body,

      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },

      method: 'POST',
      signal
    })
  } catch (error) {
    const telemetryError = getTelemetryError(error, sensitiveValues)

    console.error('Turnstile Siteverify request failed', { error: telemetryError })

    throw createTurnstileServiceError(telemetryError)
  }
}

async function readSiteverifyResponse(
  response: Response
): Promise<unknown> {
  try {
    const result: unknown = await response.json()

    return result
  } catch {
    const telemetryError: TurnstileTelemetryParseError = {
      name: 'InvalidJsonResponse'
    }

    console.error('Turnstile Siteverify returned non-JSON data', { error: telemetryError })

    throw createTurnstileServiceError(telemetryError)
  }
}

async function verifyGuestSessionTurnstile(
  event: H3Event,
  token: unknown,
  remoteIp: string
): Promise<void> {
  if (
    typeof token !== 'string'
    || token.trim() === ''
    || token.length > maximumTurnstileTokenLength
  ) {
    throw createTurnstileRejection()
  }

  if (remoteIp.trim() === '') {
    throw createTurnstileServiceError()
  }

  const config = getRuntimeTurnstileConfig(event)

  const body = new URLSearchParams({
    secret: config.secret,
    response: token,
    remoteip: remoteIp
  })

  const sensitiveValues = [token, config.secret]
  const response = await requestSiteverify(body, sensitiveValues)

  if (response.ok === false) {
    console.error('Turnstile Siteverify returned an unsuccessful status', {
      status: response.status
    })

    throw createTurnstileServiceError()
  }

  const rawResult = await readSiteverifyResponse(response)
  const parsedResult = v.safeParse(siteverifyResponseSchema, rawResult)

  if (parsedResult.success === false) {
    const telemetryIssues = getTelemetryIssues(parsedResult.issues)

    console.error('Turnstile Siteverify returned an invalid response', {
      issues: telemetryIssues
    })

    throw createTurnstileServiceError(telemetryIssues)
  }

  const result = parsedResult.output
  const telemetryResponse = getTelemetryResponse(result)

  if (hasServiceError(telemetryResponse.errorCodes)) {
    console.error('Turnstile Siteverify reported a service failure', {
      response: telemetryResponse
    })

    throw createTurnstileServiceError(telemetryResponse)
  }

  const hasExpectedAction = result.action === guestSessionTurnstileAction
  const hasExpectedHostname = result.hostname !== undefined && config.hostnames.has(result.hostname)
  const isStrictResultValid = hasExpectedAction && hasExpectedHostname
  const isResultValid = result.success && (config.isTestMode || isStrictResultValid)

  if (isResultValid === false) {
    console.error('Turnstile Siteverify rejected a Guest session', {
      response: telemetryResponse
    })

    throw createTurnstileRejection(telemetryResponse)
  }
}

export { verifyGuestSessionTurnstile }
