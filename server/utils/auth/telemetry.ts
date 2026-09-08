import { DrizzleQueryError } from 'drizzle-orm'

interface AuthErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: AuthErrorDetails;
}

/** Keep provider diagnostics while removing credentials and Drizzle parameter payloads. */
function getAuthErrorDetails(error: unknown, sensitiveValues: readonly string[], depth = 0): AuthErrorDetails {
  function redact(value: string): string {
    let result = value

    for (const sensitive of sensitiveValues) {
      if (sensitive !== '') {
        result = result.replaceAll(sensitive, '[REDACTED]')
      }
    }

    return result
  }

  if (error instanceof DrizzleQueryError) {
    const cause = depth < 4 ? getAuthErrorDetails(error.cause, sensitiveValues, depth + 1) : undefined

    return {
      name: error.name,
      message: 'Database query failed',
      cause
    }
  }

  if (error instanceof Error) {
    const name = redact(error.name)
    const message = redact(error.message)
    const stack = error.stack === undefined ? undefined : redact(error.stack)
    const rawCode: unknown = Reflect.get(error, 'code')
    const code = typeof rawCode === 'string' ? redact(rawCode) : undefined

    const cause = error.cause !== undefined && depth < 4
      ? getAuthErrorDetails(error.cause, sensitiveValues, depth + 1)
      : undefined

    return {
      name,
      message,
      stack,
      code,
      cause
    }
  }

  const message = redact(String(error))

  return {
    name: 'UnknownError',
    message
  }
}

export { getAuthErrorDetails }
