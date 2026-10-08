import { defineNuxtRouteMiddleware, shouldSkipAuth, useUserStore } from '#imports'
import { useIsErrorRendering } from '~/composables/use-error-rendering'

export default defineNuxtRouteMiddleware(async (to) => {
  if (shouldSkipAuth(to) || useIsErrorRendering(to.path)) {
    return
  }

  if (import.meta.server) {
    const { getUser, user } = useUserStore()

    if (user.value.hasData === false) {
      await getUser()
    }
  }
})
