import type { RouteLocationNormalized } from 'vue-router'

export function shouldSkipAuth(to: RouteLocationNormalized) {
  return to.meta.skipAuth === true
}
