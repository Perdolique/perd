import { startPagePath } from '~~/constants';

export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useUserStore()

  if (isAuthenticated.value && to.path === '/login') {
    return navigateTo({
      path: startPagePath,
      replace: true
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
