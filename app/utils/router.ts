import type { RouteLocationNormalized } from 'vue-router'
import { isApiRedirectPath, sanitizeRedirectPath } from '#shared/utils/redirect'

type AuthRoute = Pick<RouteLocationNormalized, 'meta' | 'path'>

function shouldSkipAuth(to: AuthRoute) {
  const isMetaSkipped = to.meta.skipAuth === true
  const isApiNavigation = isApiRedirectPath(to.path)

  return isMetaSkipped || isApiNavigation
}

function getRedirectNavigationTarget(redirectTo: unknown) {
  const path = sanitizeRedirectPath(redirectTo)

  return {
    external: isApiRedirectPath(path),
    path
  }
}

export { getRedirectNavigationTarget, shouldSkipAuth }
