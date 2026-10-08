import { getRequestMetadataHeader } from '#server/utils/request-runtime'
import { isSamePath } from 'ufo'

import {
  createError,
  defineEventHandler,
  getRequestURL,
  isNuxtError,
  sendRedirect,
  type RequestEvent
} from 'nuxt/server'

import { passwordRecoveryApiPaths } from '#shared/utils/email-authentication'
import { validateSessionUser } from '#server/utils/session'

const apiBase = '/api'

const publicApiPaths = [
  '/api/auth/create-session',
  '/api/auth/email/registration',
  '/api/auth/email/registration/verify',
  '/api/auth/email/sign-in',
  '/api/auth/passkeys/options',
  '/api/auth/passkeys/verify',
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
function isBrowserNavigationRequest(event: RequestEvent) {
  const acceptHeader = getRequestMetadataHeader(event, 'accept')
  const secFetchDestHeader = getRequestMetadataHeader(event, 'sec-fetch-dest')
  const secFetchModeHeader = getRequestMetadataHeader(event, 'sec-fetch-mode')
  const acceptsHtml = acceptHeader?.includes('text/html') === true

  if (secFetchDestHeader === 'document') {
    return true
  }

  if (secFetchModeHeader === 'navigate' && acceptsHtml) {
    return true
  }

  return secFetchModeHeader === undefined && acceptsHtml
}

// oxlint-disable-next-line typescript/no-invalid-void-type -- Middleware returns a redirect body or continues to the next handler.
export default defineEventHandler(async (event): Promise<string | void> => {
  const url = getRequestURL(event)

  if (/^\/api\/(?:account|auth)\/passkeys(?:\/|$)/u.test(url.pathname)) {
    event.res.headers.set('Cache-Control', 'no-store')
  }

  const isApiPath = url.pathname.startsWith(apiBase)

  if (isApiPath && !isPublicApiPath(url.pathname)) {
    try {
      await validateSessionUser(event)
    } catch (error) {
      if (!isNuxtError(error) || error.status !== 401) {
        throw error
      }

      const isBrowserNavigation = isBrowserNavigationRequest(event)

      if (isBrowserNavigation) {
        const loginPath = new URL('/login', url.origin)

        loginPath.searchParams.set('redirectTo', `${url.pathname}${url.search}`)

        const loginRedirectUrl = `${loginPath.pathname}${loginPath.search}`
        const redirectResponse = sendRedirect(event, loginRedirectUrl)

        return redirectResponse
      }

      throw createError({ status: 401 })
    }
  }
})
