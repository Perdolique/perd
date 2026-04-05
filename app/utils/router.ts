import type { RouteLocationNormalized } from 'vue-router'
import { isApiRedirectPath, sanitizeRedirectPath } from '#shared/utils/redirect'

function shouldSkipAuth(to: RouteLocationNormalized) {
  return to.meta.skipAuth === true
}

function getRedirectNavigationTarget(redirectTo: unknown) {
  const path = sanitizeRedirectPath(redirectTo)

  return {
    external: isApiRedirectPath(path),
    path
  }
}

export { getRedirectNavigationTarget, shouldSkipAuth }
