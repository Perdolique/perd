import { isSamePath } from 'ufo'

import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  isError,
  sendRedirect,
  type EventHandlerRequest,
  type H3Event
} from 'h3'

import { passwordRecoveryApiPaths } from '#shared/utils/email-authentication'
import { validateSessionUser } from '#server/utils/session'

const apiBase = '/api'

const publicApiPaths = [
  '/api/auth/create-session',
  '/api/auth/email/registration',
  '/api/auth/email/registration/verify',
  '/api/auth/email/sign-in',
  '/api/oauth/twitch',
  ...passwordRecoveryApiPaths
] as const

const publicApiPathPrefixes = ['/api/_nuxt_icon/'] as const

function isPublicApiPath(pathname: string) {
  const hasExactPublicPath = publicApiPaths.some(path => isSamePath(path, pathname))
  const hasPublicPrefix = publicApiPathPrefixes.some((pathPrefix) => pathname.startsWith(pathPrefix))

  return hasExactPublicPath || hasPublicPrefix
}

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

  if (isApiPath && !isPublicApiPath(url.pathname)) {
    try {
      await validateSessionUser(event)
    } catch (error) {
      if (!isError(error) || error.statusCode !== 401) {
        throw error
      }

      const isBrowserNavigation = isBrowserNavigationRequest(event)

      if (isBrowserNavigation) {
        const loginPath = new URL('/login', url.origin)

        loginPath.searchParams.set('redirectTo', `${url.pathname}${url.search}`)
        await sendRedirect(event, `${loginPath.pathname}${loginPath.search}`)

        return
      }

      throw createError({ status: 401 })
    }
  }
})
