import { appLocations } from '~/utils/navigation'
import { defineNuxtRouteMiddleware, navigateTo, useUserStore } from '#imports'
import { useIsErrorRendering } from '~/composables/use-error-rendering'

export default defineNuxtRouteMiddleware(async (to) => {
  const isErrorRendering = useIsErrorRendering(to.path)

  if (isErrorRendering) {
    return
  }

  const { user } = useUserStore()

  if (user.value.isAdmin === false) {
    return navigateTo({
      name: appLocations.home.name
    }, {
      replace: true
    })
  }
})
