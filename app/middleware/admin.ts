import { startPagePath } from "~~/constants";

export default defineNuxtRouteMiddleware(async (to) => {
  const { user } = useUserStore()

  if (user.value.isAdmin === false && to.path !== startPagePath) {
    return navigateTo(startPagePath, {
      replace: true
    })
  }
})
