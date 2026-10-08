import { createError, getRouterParams, isNuxtError, type RequestEvent } from 'nuxt/server'

/** Validates decoded route params and keeps the raw validation error as the cause. */
async function getValidatedRouteParams<Data>(event: RequestEvent, validate: (params: unknown) => Data | Promise<Data>): Promise<Data> {
  const params = getRouterParams(event, { decode: true })

  try {
    return await validate(params)
  } catch (error) {
    if (isNuxtError(error)) {
      throw error
    }

    throw createError({
      status: 400,
      statusText: 'Validation Error',
      cause: error
    })
  }
}

export { getValidatedRouteParams }
