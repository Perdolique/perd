import { getRequestURL, send, setResponseHeaders, setResponseStatus } from 'h3'
import { defineNitroErrorHandler } from 'nitropack/runtime'

const passkeyApiPathPattern = /^\/api\/(?:account|auth)\/passkeys(?:\/|$)/u

// oxlint-disable-next-line import/no-default-export, promise/prefer-await-to-callbacks -- Nitro requires this default-exported callback contract.
export default defineNitroErrorHandler(async (error, event, { defaultHandler }) => {
  const { pathname } = getRequestURL(event)
  const isPasskeyNotFound = error.statusCode === 404 && passkeyApiPathPattern.test(pathname)

  if (!isPasskeyNotFound) {
    return
  }

  const response = await defaultHandler(error, event)

  response.headers['cache-control'] = 'no-store'

  setResponseHeaders(event, response.headers)
  setResponseStatus(event, response.status, response.statusText)

  const responseBody = typeof response.body === 'string'
    ? response.body
    : JSON.stringify(response.body, null, 2)

  await send(event, responseBody)
})
