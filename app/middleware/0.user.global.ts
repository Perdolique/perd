import { defineNuxtRouteMiddleware, shouldSkipAuth, useUserStore } from '#imports'
import { useIsErrorRendering } from '~/composables/use-error-rendering'

export default defineNuxtRouteMiddleware(async (to) => {
  const skipAuth = shouldSkipAuth(to)

  if (skipAuth) {
    return
  }

  const isErrorRendering = useIsErrorRendering(to.path)

  if (isErrorRendering) {
    return
  }

  const { getUser, user } = useUserStore()

  if (user.value.hasData === false) {
    await getUser()
  }
})
