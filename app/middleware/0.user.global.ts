export default defineNuxtRouteMiddleware(async (to) => {
  if (shouldSkipAuth(to)) {
    return
  }

  if (import.meta.server) {
    const { getUser, user } = useUserStore()

    if (user.value.hasData === false) {
      await getUser()
    }
  }
})
