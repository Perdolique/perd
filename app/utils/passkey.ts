import { passkeyMessages } from '#shared/utils/passkey'

function getPasskeyRequestStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') {
    return
  }

  const status: unknown = Reflect.get(error, 'statusCode') ?? Reflect.get(error, 'status')

  return typeof status === 'number' ? status : undefined
}

function isPasskeyCancellation(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'NotAllowedError'
    || error.name === 'AbortError'
  )
}

function getPasskeyErrorMessage(error: unknown): string {
  if (isPasskeyCancellation(error)) {
    return passkeyMessages.cancelled
  }

  const status = getPasskeyRequestStatus(error)

  if (status === 429) {
    return passkeyMessages.tooManyAttempts
  } else if (status === 503) {
    return passkeyMessages.unavailable
  } else if (status === 409 || (error instanceof Error && error.name === 'InvalidStateError')) {
    return passkeyMessages.duplicate
  }

  return passkeyMessages.invalid
}

export { getPasskeyErrorMessage, getPasskeyRequestStatus, isPasskeyCancellation }
