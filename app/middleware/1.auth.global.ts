import { defineNuxtRouteMiddleware, navigateTo, shouldSkipAuth, useUserStore } from '#imports';
import { getRedirectNavigationTarget } from '~/utils/router'

export default defineNuxtRouteMiddleware(async (to) => {
  if (shouldSkipAuth(to)) {
    return
  }

  const { isAuthenticated } = useUserStore()

  if (isAuthenticated.value && to.path === '/login') {
    const navigationTarget = getRedirectNavigationTarget(to.query.redirectTo)

    return navigateTo({
      path: navigationTarget.path
    }, {
      replace: true,
      external: navigationTarget.external
    })
  }

  if (isAuthenticated.value === false && to.path !== '/login') {
    return navigateTo({
      path: '/login',
      replace: true,

      query: {
        redirectTo: to.fullPath
      }
    })
  }
})
