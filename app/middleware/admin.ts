import { defineNuxtRouteMiddleware, navigateTo, useUserStore } from '#imports'

export default defineNuxtRouteMiddleware(async () => {
  const { user } = useUserStore()

  if (user.value.isAdmin === false) {
    return navigateTo({
      path: '/'
    }, {
      replace: true
    })
  }
})
