import { appLocations } from '~/utils/navigation'
import { defineNuxtRouteMiddleware, navigateTo, shouldSkipAuth, useUserStore } from '#imports'
import { useIsErrorRendering } from '~/composables/use-error-rendering'
import { getRedirectNavigationTarget } from '~/utils/router'

export default defineNuxtRouteMiddleware(async (to) => {
  if (shouldSkipAuth(to) || useIsErrorRendering(to.path)) {
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
      name: appLocations.login.name,
      replace: true,

      query: {
        redirectTo: to.fullPath
      }
    })
  }
})
