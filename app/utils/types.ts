import { FetchError } from 'ofetch'

export function isRecord(value: unknown) : value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getFetchErrorMessage(error: unknown) : string {
  if (error instanceof FetchError) {
    if (typeof error.data.message === 'string') {
      return error.data.message
    }

    return error.message
  }

  return '¯\\(ツ)/¯'
}
