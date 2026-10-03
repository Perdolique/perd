import { getFetchErrorResponse } from './fetch-error'

/** Reads only the safe conflict code returned by characteristic APIs. */
function getCategoryPropertiesErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') { return }

  const response: unknown = Reflect.get(error, 'data')

  if (response === null || typeof response !== 'object') { return }

  const data: unknown = Reflect.get(response, 'data')

  if (data === null || typeof data !== 'object') { return }

  const code: unknown = Reflect.get(data, 'code')

  return typeof code === 'string' ? code : undefined
}

/** Keeps raw client failures when no server response can provide diagnostics. */
function logUnexpectedCategoryPropertiesError(message: string, error: unknown) {
  const { status } = getFetchErrorResponse(error)

  if (status === undefined) {
    globalThis.console.error(message, error)
  }
}

export { getCategoryPropertiesErrorCode, logUnexpectedCategoryPropertiesError }
