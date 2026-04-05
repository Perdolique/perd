import { isSamePath, withBase } from 'ufo'
import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendRedirect,
  type EventHandlerRequest,
  type H3Event
} from 'h3'
import { getAppSession } from '#server/utils/session'

const apiBase = '/api'

const publicApiPaths = [
  '/auth/create-session',
  '/oauth/twitch'
] as const

/**
 * Detects whether an unauthenticated `/api/*` request came from a browser page
 * navigation, not from programmatic API usage.
 *
 * We use Fetch Metadata headers when they are present:
 * - `sec-fetch-dest: document` is the strongest signal for opening a page
 * - `sec-fetch-mode: navigate` plus `Accept: text/html` covers regular browser navigations
 *
 * Some clients and intermediaries omit Fetch Metadata headers, so we keep a
 * narrow fallback: if `sec-fetch-mode` is missing but the client explicitly
 * accepts HTML, we still treat it as a document request. Everything else stays
 * on the API path and receives a plain `401`.
 */
function isBrowserNavigationRequest(event: H3Event<EventHandlerRequest>) {
  const acceptHeader = getHeader(event, 'accept')
  const secFetchDestHeader = getHeader(event, 'sec-fetch-dest')
  const secFetchModeHeader = getHeader(event, 'sec-fetch-mode')
  const acceptsHtml = acceptHeader?.includes('text/html') === true

  if (secFetchDestHeader === 'document') {
    return true
  }

  if (secFetchModeHeader === 'navigate' && acceptsHtml) {
    return true
  }

  return secFetchModeHeader === undefined && acceptsHtml
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const isApiPath = url.pathname.startsWith(apiBase)

  if (isApiPath) {
    const session = await getAppSession(event)
    const { userId } = session.data

    const isPublic = publicApiPaths.some((path) => {
      const apiPath = withBase(path, apiBase)

      return isSamePath(apiPath, url.pathname)
    })

    if (isPublic === false && userId === undefined) {
      const isBrowserNavigation = isBrowserNavigationRequest(event)

      if (isBrowserNavigation) {
        const loginPath = new URL('/login', url.origin)

        loginPath.searchParams.set('redirectTo', `${url.pathname}${url.search}`)

        await sendRedirect(event, `${loginPath.pathname}${loginPath.search}`)

        return
      }

      throw createError({
        status: 401
      })
    }
  }
})
