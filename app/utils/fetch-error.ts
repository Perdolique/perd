interface FetchErrorResponse {
  status?: number;
  statusMessage?: string;
}

/** Extracts the safe response fields shared by client-side fetch error policies. */
function getFetchErrorResponse(error: unknown): FetchErrorResponse {
  if (error === null || typeof error !== 'object') {
    return {}
  }

  const data: unknown = Reflect.get(error, 'data')

  if (data === null || typeof data !== 'object') {
    return {}
  }

  const rawStatus: unknown = Reflect.get(data, 'statusCode')
  const rawMessage: unknown = Reflect.get(data, 'statusMessage')

  return {
    status: typeof rawStatus === 'number' ? rawStatus : undefined,
    statusMessage: typeof rawMessage === 'string' ? rawMessage : undefined
  }
}

export { getFetchErrorResponse }
